import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';

import { getDb } from '../db/client.mjs';
import { accounts, sessions, users, verifications } from '../db/schema/auth.mjs';

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be configured in the server environment.`);
  }
  return value;
}

function allowedHosts() {
  const configured = process.env.BETTER_AUTH_ALLOWED_HOSTS;
  return (configured || 'localhost:5173,localhost:3000')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);
}

export function internalAuthHeaders() {
  const host = allowedHosts().find((value) => !value.includes('*')) || 'localhost:3000';
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const origin = `${protocol}://${host}`;
  return new Headers({ host, origin });
}

function authConfiguration({ allowProvisioning, sendResetPassword, revokeSessionsOnPasswordReset = false }) {
  return {
    appName: 'WHMX Admin',
    secret: requiredEnvironment('BETTER_AUTH_SECRET'),
    basePath: '/api/auth',
    baseURL: {
      allowedHosts: allowedHosts(),
      protocol: process.env.NODE_ENV === 'production' ? 'https' : 'auto',
    },
    trustedOrigins: allowedHosts().map((host) =>
      `${process.env.NODE_ENV === 'production' ? 'https' : 'http'}://${host}`,
    ),
    database: drizzleAdapter(getDb(), {
      provider: 'pg',
      usePlural: true,
      schema: {
        users,
        sessions,
        accounts,
        verifications,
      },
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !allowProvisioning,
      // Server-side provisioning must never mint a session for the operator or
      // the account recipient.
      autoSignIn: false,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      ...(sendResetPassword ? { sendResetPassword, revokeSessionsOnPasswordReset } : {}),
    },
    user: {
      additionalFields: {
        role: {
          type: ['owner', 'editor'],
          required: false,
          defaultValue: 'editor',
          input: false,
        },
        status: {
          type: ['active', 'disabled'],
          required: false,
          defaultValue: 'active',
          input: false,
        },
        lastLoginAt: {
          type: 'date',
          required: false,
          input: false,
        },
        disabledAt: {
          type: 'date',
          required: false,
          input: false,
        },
        disabledByUserId: {
          type: 'string',
          required: false,
          input: false,
        },
      },
    },
    advanced: {
      cookiePrefix: 'whmx-admin',
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      },
      database: {
        generateId: 'uuid',
        validateSchema: process.env.NODE_ENV !== 'production',
      },
    },
    logger: { disabled: true },
    telemetry: { enabled: false },
  };
}

// Only this handler is mounted under /api/auth. Its sign-up endpoint remains
// disabled to the public.
export const auth = betterAuth(authConfiguration({ allowProvisioning: false }));

// Used only by the server-side owner domain and CLI. It delegates password
// validation and hashing to Better Auth without adding another HTTP route.
export const provisioningAuth = betterAuth(authConfiguration({ allowProvisioning: true }));

// This instance exists only for one-shot server-side password recovery. Its
// reset token callback is supplied by the CLI/domain and kept in process
// memory; it does not enable a public reset-email endpoint or public signup.
export function createPasswordRecoveryAuth(sendResetPassword) {
  return betterAuth(authConfiguration({
    allowProvisioning: false,
    sendResetPassword,
    revokeSessionsOnPasswordReset: true,
  }));
}
