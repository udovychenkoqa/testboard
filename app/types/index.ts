import { SVGProps } from 'react';

import { type HeaderLinks } from '@/app/config/site';

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

export type UUID = `${string}-${string}-${string}-${string}-${string}`;

export interface SiteWhiteLabelConfig {
  title: string;
  headerLinks: HeaderLinks;
  logoPath: string;
  faviconPath: string;
  reporterPaths?: string[];
  authRequired?: boolean;
  serverCache?: boolean;
  dataStorage?: string;
  s3Endpoint?: string;
  s3Bucket?: string;
  cron?: {
    resultExpireDays?: number;
    resultExpireCronSchedule?: string;
    reportExpireDays?: number;
    reportExpireCronSchedule?: string;
  };
  ai?: {
    // false = new reports are not auto-analyzed; manual Generate still works
    autoAnalyzeEnabled?: boolean;
    // Anthropic model id; empty/undefined = ANTHROPIC_MODEL env value
    model?: string;
  };
  // Access control: admin-managed map of email → role label. Only 'admin' is
  // privileged (see app/lib/access.ts). Env AUTH_ADMIN_EMAILS is a bootstrap
  // fallback so the first admin can sign in before this map exists.
  access?: {
    users?: Record<string, string>;
  };
  notifications?: {
    enabled: boolean;
    baseUrl?: string;
    channels: Array<{
      id: string;
      name: string;
      type: 'slack' | 'webhook';
      url: string;
      condition: 'always' | 'has_failures' | 'has_failures_or_recovered';
      project?: string;
      enabled?: boolean;
    }>;
  };
}

export interface EnvInfo {
  authRequired: boolean;
  serverCache: boolean | undefined;
  dataStorage: string | undefined;
  s3Endpoint: string | undefined;
  s3Bucket: string | undefined;
}
