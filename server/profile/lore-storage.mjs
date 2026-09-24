// server/profile/lore-storage.mjs
// R2 access for lore: public bucket under LORE_PUBLISH_PREFIX + a private backup bucket.
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export function loadLoreStorageConfig(env = process.env) {
  const need = (name) => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`${name} is not configured`);
    return value;
  };
  const prefix = need('LORE_PUBLISH_PREFIX');
  const match = /^lore\/(production|preview|development)\/$/.exec(prefix);
  if (!match) throw new Error('LORE_PUBLISH_PREFIX must be lore/<production|preview|development>/');
  return {
    endpoint: need('R2_ENDPOINT'), bucket: need('R2_BUCKET'), backupBucket: need('R2_BACKUP_BUCKET'),
    accessKeyId: need('R2_ACCESS_KEY_ID'), secretAccessKey: need('R2_SECRET_ACCESS_KEY'), prefix, envName: match[1],
  };
}

export function createLoreStorage(config) {
  const client = new S3Client({ region: 'auto', endpoint: config.endpoint, credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } });
  return {
    envName: config.envName,
    async putPublic(name, body, { cacheControl }) {
      await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: `${config.prefix}${name}`, Body: body, ContentType: 'application/json; charset=utf-8', CacheControl: cacheControl }));
    },
    async publicFileExists(name) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: `${config.prefix}${name}` }));
        return true;
      } catch (error) {
        if (error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404) return false;
        throw error;
      }
    },
    async readPointerFile() {
      try {
        const response = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: `${config.prefix}lore.pointer.json` }));
        return JSON.parse(await response.Body.transformToString()).file ?? null;
      } catch (error) {
        if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) return null;
        throw error;
      }
    },
    async putBackup(key, buffer) {
      await client.send(new PutObjectCommand({ Bucket: config.backupBucket, Key: key, Body: buffer, ContentType: 'application/gzip' }));
    },
  };
}
