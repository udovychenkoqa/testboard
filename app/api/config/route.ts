import fs from 'node:fs/promises';
import path from 'node:path';

import { revalidatePath } from 'next/cache';

import { withError } from '@/app/lib/withError';
import { DATA_FOLDER } from '@/app/lib/storage/constants';
import { resolveInside } from '@/app/lib/safePath';
import { service } from '@/app/lib/service';
import { env } from '@/app/config/env';
import { cronService } from '@/app/lib/service/cron';
import { auth } from '@/app/auth';
import { AUTH_ENABLED, GOOGLE_ENABLED } from '@/app/lib/authFlags';

export const dynamic = 'force-dynamic'; // defaults to auto

const saveFile = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer();

  const buffer = Buffer.from(arrayBuffer);

  await fs.writeFile(resolveInside(DATA_FOLDER, path.basename(file.name)), buffer, { encoding: 'binary' });
};

const parseHeaderLinks = async (headerLinks: string): Promise<Record<string, string>> => {
  return JSON.parse(headerLinks);
};

export async function PATCH(request: Request) {
  const { result: formData, error: formParseError } = await withError(request.formData());

  if (formParseError) {
    return Response.json({ error: formParseError.message }, { status: 400 });
  }

  if (!formData) {
    return Response.json({ error: 'Form data is missing' }, { status: 400 });
  }

  const logo = formData.get('logo') as File;

  if (logo) {
    const { error: logoError } = await withError(saveFile(logo));

    if (logoError) {
      return Response.json({ error: `failed to save logo: ${logoError?.message}` }, { status: 500 });
    }
  }

  const title = formData.get('title');
  const logoPath = formData.get('logoPath');
  const reporterPaths = formData.get('reporterPaths');
  const headerLinks = formData.get('headerLinks');
  const resultExpireDays = formData.get('resultExpireDays');
  const resultExpireCronSchedule = formData.get('resultExpireCronSchedule');
  const reportExpireDays = formData.get('reportExpireDays');
  const reportExpireCronSchedule = formData.get('reportExpireCronSchedule');

  const config = await service.getConfig();

  if (!config) {
    return Response.json({ error: `failed to get config` }, { status: 500 });
  }

  if (title !== null) {
    config.title = title.toString();
  }

  if (logo) {
    config.logoPath = `/${path.basename(logo.name)}`;
  } else if (logoPath !== null) {
    config.logoPath = logoPath.toString();
  }

  const ai = formData.get('ai');

  if (ai !== null) {
    try {
      config.ai = JSON.parse(ai.toString());
    } catch {
      return Response.json({ error: 'failed to parse ai config' }, { status: 400 });
    }
  }

  const notifications = formData.get('notifications');

  if (notifications !== null) {
    try {
      config.notifications = JSON.parse(notifications.toString());
    } catch {
      return Response.json({ error: 'failed to parse notifications config' }, { status: 400 });
    }
  }

  if (reporterPaths !== null) {
    try {
      config.reporterPaths = JSON.parse(reporterPaths.toString());
    } catch {
      config.reporterPaths = [reporterPaths.toString()];
    }
  }

  if (headerLinks) {
    const { result: parsedHeaderLinks, error: parseHeaderLinksError } = await withError(
      parseHeaderLinks(headerLinks.toString()),
    );

    if (parseHeaderLinksError) {
      return Response.json(
        { error: `failed to parse header links: ${parseHeaderLinksError.message}` },
        { status: 400 },
      );
    }

    if (parsedHeaderLinks) config.headerLinks = parsedHeaderLinks;
  }

  if (!config.cron) {
    config.cron = {};
  }

  // A provided-but-empty value clears the setting (expiry off); an absent
  // field leaves the current value untouched.
  const parseDays = (value: FormDataEntryValue): number | undefined => {
    const parsed = parseInt(value.toString().trim());

    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  };

  const cronTouched =
    resultExpireDays !== null ||
    resultExpireCronSchedule !== null ||
    reportExpireDays !== null ||
    reportExpireCronSchedule !== null;

  if (resultExpireDays !== null) {
    config.cron.resultExpireDays = parseDays(resultExpireDays);
  }
  if (resultExpireCronSchedule !== null && resultExpireCronSchedule.toString().trim()) {
    config.cron.resultExpireCronSchedule = resultExpireCronSchedule.toString().trim();
  }
  if (reportExpireDays !== null) {
    config.cron.reportExpireDays = parseDays(reportExpireDays);
  }
  if (reportExpireCronSchedule !== null && reportExpireCronSchedule.toString().trim()) {
    config.cron.reportExpireCronSchedule = reportExpireCronSchedule.toString().trim();
  }

  const { error: saveConfigError } = await withError(service.updateConfig(config));

  if (saveConfigError) {
    return Response.json({ error: `failed to save config: ${saveConfigError.message}` }, { status: 500 });
  }

  if (cronTouched) {
    await cronService.restart();
  }

  revalidatePath('/', 'layout');
  revalidatePath('/login', 'layout');

  return Response.json({ message: 'config saved' });
}

export async function GET() {
  const config = await service.getConfig();

  if (!config) {
    return Response.json({ error: 'Config not found' }, { status: 404 });
  }

  const session = await auth();
  const role = session?.user?.role ?? null;

  // Public envInfo — safe for anyone (the login page reads authRequired/
  // googleEnabled before the user is signed in, so this route stays in the
  // middleware allowlist).
  const publicInfo = {
    // Login gate is active whenever API_TOKEN OR Google is configured.
    authRequired: AUTH_ENABLED,
    googleEnabled: GOOGLE_ENABLED,
    // Current viewer's role so the client can hide admin-only UI (server still
    // enforces via middleware — this is UX only).
    role,
    serverCache: env.USE_SERVER_CACHE,
    dataStorage: env.DATA_STORAGE,
    s3Endpoint: env.S3_ENDPOINT,
    s3Bucket: env.S3_BUCKET,
  };

  // The full config carries secrets (notification webhook URLs, AI settings) —
  // return it only to admins. Non-admins/viewers get just the public flags, so
  // this public route never leaks Slack webhooks to a read-only user.
  if (role !== 'admin') {
    return Response.json(publicInfo, { status: 200 });
  }

  return Response.json({ ...config, ...publicInfo }, { status: 200 });
}
