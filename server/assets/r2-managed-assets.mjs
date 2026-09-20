import { createHash, randomUUID } from 'node:crypto';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';

const MIME_BY_FORMAT = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export const MANAGED_ASSET_POLICIES = Object.freeze({
  avatar: Object.freeze({ maxBytes: 4 * 1024 * 1024, maxDimension: 1024 }),
  card: Object.freeze({ maxBytes: 10 * 1024 * 1024, maxDimension: 2560 }),
  drawing: Object.freeze({ maxBytes: 12 * 1024 * 1024, maxDimension: 3072 }),
});

const CONFIGURATION_ERROR = 'R2 managed asset storage is not configured.';

export class ManagedAssetError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'ManagedAssetError';
    this.code = code;
    this.expose = options.expose ?? false;
  }
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new ManagedAssetError('STORAGE_UNAVAILABLE', CONFIGURATION_ERROR);
  return value;
}

export function validateManagedAssetPrefix(value) {
  const prefix = String(value ?? '').trim().replace(/^\/+|\/+$/g, '');
  if (
    !/^admin-[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?(?:\/[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?)*$/i.test(prefix) ||
    prefix.includes('..') ||
    /^(?:characters|skins|series|public|source)(?:\/|$)/i.test(prefix)
  ) {
    throw new ManagedAssetError('STORAGE_UNAVAILABLE', CONFIGURATION_ERROR);
  }
  return prefix;
}

export function loadR2ManagedAssetConfig() {
  const endpoint = requiredEnvironment('R2_ENDPOINT');
  const bucket = requiredEnvironment('R2_BUCKET');
  const accessKeyId = requiredEnvironment('R2_ACCESS_KEY_ID');
  const secretAccessKey = requiredEnvironment('R2_SECRET_ACCESS_KEY');
  const publicBaseUrl = requiredEnvironment('R2_PUBLIC_BASE_URL').replace(/\/$/, '');
  let parsedEndpoint;
  let parsedPublicBaseUrl;
  try {
    parsedEndpoint = new URL(endpoint);
    parsedPublicBaseUrl = new URL(publicBaseUrl);
  } catch {
    throw new ManagedAssetError('STORAGE_UNAVAILABLE', CONFIGURATION_ERROR);
  }
  if (parsedEndpoint.protocol !== 'https:' || parsedPublicBaseUrl.protocol !== 'https:') {
    throw new ManagedAssetError('STORAGE_UNAVAILABLE', CONFIGURATION_ERROR);
  }
  const prefix = validateManagedAssetPrefix(process.env.R2_MANAGED_ASSET_PREFIX);
  return Object.freeze({ endpoint, bucket, accessKeyId, secretAccessKey, publicBaseUrl, prefix });
}

export function createR2ManagedAssetStorage(config = loadR2ManagedAssetConfig()) {
  const client = new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    forcePathStyle: false,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  return {
    bucket: config.bucket,
    prefix: config.prefix,
    publicBaseUrl: config.publicBaseUrl,
    async presignPut({ key, expiresInSeconds = 900 }) {
      const command = new PutObjectCommand({ Bucket: config.bucket, Key: key });
      return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    },
    async head(key) {
      return client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
    },
    async get(key) {
      return client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
    },
    async put({ key, body, contentType }) {
      return client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentLength: body.length,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    },
    async remove(key) {
      return client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
  };
}

export function quarantineObjectKey(prefix, intentId) {
  const safePrefix = validateManagedAssetPrefix(prefix);
  if (!/^[0-9a-f-]{36}$/i.test(intentId)) {
    throw new ManagedAssetError('VALIDATION_ERROR', 'Invalid upload intent identifier.');
  }
  return `${safePrefix}/quarantine/uploads/${intentId}/original`;
}

export function deliveryObjectKey(prefix, entityId, assetRole, assetId, contentHash) {
  const safePrefix = validateManagedAssetPrefix(prefix);
  if (![entityId, assetId].every((value) => /^[0-9a-f-]{36}$/i.test(value))) {
    throw new ManagedAssetError('VALIDATION_ERROR', 'Invalid managed asset identifier.');
  }
  if (!/^(avatar|card|drawing)$/.test(assetRole) || !/^[0-9a-f]{64}$/i.test(contentHash)) {
    throw new ManagedAssetError('VALIDATION_ERROR', 'Invalid managed asset key components.');
  }
  return `${safePrefix}/manual/previews/characters/${entityId}/${assetRole}/${assetId}/${contentHash}.webp`;
}

export function publicDeliveryUrl(publicBaseUrl, key) {
  const base = new URL(publicBaseUrl);
  if (base.protocol !== 'https:') throw new ManagedAssetError('STORAGE_UNAVAILABLE', CONFIGURATION_ERROR);
  return `${base.toString().replace(/\/$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function boundedBodyToBuffer(body, maxBytes) {
  if (!body) throw new ManagedAssetError('OBJECT_INVALID', 'The uploaded object could not be read.');
  const chunks = [];
  let total = 0;
  if (typeof body[Symbol.asyncIterator] === 'function') {
    for await (const chunk of body) {
      const buffer = Buffer.from(chunk);
      total += buffer.length;
      if (total > maxBytes) throw new ManagedAssetError('OBJECT_TOO_LARGE', 'The uploaded object exceeds its role limit.');
      chunks.push(buffer);
    }
  } else {
    const buffer = Buffer.from(await body.transformToByteArray());
    if (buffer.length > maxBytes) throw new ManagedAssetError('OBJECT_TOO_LARGE', 'The uploaded object exceeds its role limit.');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, total);
}

export async function inspectAndOptimizeImage(buffer, assetRole) {
  const policy = MANAGED_ASSET_POLICIES[assetRole];
  if (!policy) throw new ManagedAssetError('VALIDATION_ERROR', 'Unsupported managed asset role.');
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new ManagedAssetError('OBJECT_INVALID', 'The uploaded object is not a valid image.');
  if (buffer.length > policy.maxBytes) throw new ManagedAssetError('OBJECT_TOO_LARGE', 'The uploaded object exceeds its role limit.');

  const detected = await fileTypeFromBuffer(buffer).catch(() => null);
  if (!detected || !Object.values(MIME_BY_FORMAT).includes(detected.mime)) {
    throw new ManagedAssetError('OBJECT_INVALID', 'The uploaded object is not a supported image.');
  }

  let image;
  let metadata;
  try {
    image = sharp(buffer, { limitInputPixels: 40_000_000, sequentialRead: true });
    metadata = await image.metadata();
  } catch {
    throw new ManagedAssetError('OBJECT_INVALID', 'The uploaded object is not a decodable image.');
  }
  const detectedMime = MIME_BY_FORMAT[metadata.format];
  if (!detectedMime || detected.mime !== detectedMime || !metadata.width || !metadata.height) {
    throw new ManagedAssetError('OBJECT_INVALID', 'The uploaded object failed image verification.');
  }
  if (metadata.pages && metadata.pages > 1) {
    throw new ManagedAssetError('OBJECT_INVALID', 'Animated images are not supported.');
  }

  let output;
  try {
    output = await image
      .resize(policy.maxDimension, policy.maxDimension, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 88, effort: 4 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new ManagedAssetError('OBJECT_INVALID', 'The uploaded image could not be processed.');
  }
  const outputMetadata = await sharp(output.data).metadata();
  if (!outputMetadata.width || !outputMetadata.height || outputMetadata.format !== 'webp') {
    throw new ManagedAssetError('OBJECT_INVALID', 'The processed image failed verification.');
  }
  return {
    sourceHash: sha256(buffer),
    sourceBytes: buffer.length,
    sourceMimeType: detectedMime,
    sourceWidth: metadata.width,
    sourceHeight: metadata.height,
    output: output.data,
    outputHash: sha256(output.data),
    outputBytes: output.data.length,
    outputWidth: outputMetadata.width,
    outputHeight: outputMetadata.height,
  };
}

export async function readVerifiedUploadObject(storage, key, maxBytes) {
  let head;
  try {
    head = await storage.head(key);
  } catch {
    throw new ManagedAssetError('OBJECT_NOT_FOUND', 'The upload object was not found.');
  }
  const contentLength = Number(head.ContentLength);
  if (!Number.isSafeInteger(contentLength) || contentLength <= 0 || contentLength > maxBytes) {
    throw new ManagedAssetError('OBJECT_TOO_LARGE', 'The uploaded object exceeds its role limit.');
  }
  let response;
  try {
    response = await storage.get(key);
  } catch {
    throw new ManagedAssetError('OBJECT_INVALID', 'The uploaded object could not be read.');
  }
  const body = await boundedBodyToBuffer(response.Body, maxBytes);
  if (body.length !== contentLength) throw new ManagedAssetError('OBJECT_INVALID', 'The uploaded object changed during verification.');
  return { body, head };
}

export function newDeliveryAssetId() {
  return randomUUID();
}
