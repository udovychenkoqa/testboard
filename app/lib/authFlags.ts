import { env } from '@/app/config/env';
import { type RolePolicy } from '@/app/lib/access';

// Google is on only when both credentials are present.
export const GOOGLE_ENABLED = !!env.AUTH_GOOGLE_ID && !!env.AUTH_GOOGLE_SECRET;

// Auth is "required" (login gate active) when either the API token OR Google
// login is configured. When neither is set the app stays fully open, exactly
// as before this feature (open mode = implicit admin).
export const AUTH_ENABLED = !!env.API_TOKEN || GOOGLE_ENABLED;

const splitList = (value: string): string[] =>
  value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

export const ROLE_POLICY: RolePolicy = {
  adminEmails: splitList(env.AUTH_ADMIN_EMAILS),
  allowedDomains: splitList(env.AUTH_ALLOWED_DOMAINS),
};
