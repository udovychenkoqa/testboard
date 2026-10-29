import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

import { type BrowserContext, type Page } from '@playwright/test';

export const E2E_PROJECT = 'e2e';

// IDs created by global.setup.ts, shared with the specs through a file
// (setup and specs run in separate workers).
const SEED_FILE = path.join(__dirname, '.auth', 'seed.json');

export interface Seed {
  resultID: string;
  reportId: string;
}

export const saveSeed = async (seed: Seed) => {
  await mkdir(path.dirname(SEED_FILE), { recursive: true });
  await writeFile(SEED_FILE, JSON.stringify(seed));
};

export const loadSeed = async (): Promise<Seed> => JSON.parse(await readFile(SEED_FILE, 'utf8')) as Seed;

// Pick the UI language for a test explicitly (the cookie the language switch writes).
export const useLanguage = async (context: BrowserContext, locale: 'en' | 'uk', baseURL: string) => {
  await context.addCookies([{ name: 'NEXT_LOCALE', value: locale, url: baseURL }]);
};

// Files the report page probes for and that legitimately 404 when absent:
// the AI summary only exists once AI analysis has run (disabled in e2e).
const OPTIONAL_FILES = /\/ai-summary(-status\.json|\.md)$/;

// Console errors worth failing a test on (dev-only noise filtered out).
export const collectConsoleErrors = (page: Page): string[] => {
  const errors: string[] = [];

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();

    // Resource failures are reported with their URL by the response listener below.
    if (/Download the React DevTools|\[Fast Refresh\]|favicon|Failed to load resource/i.test(text)) return;
    errors.push(text);
  });
  page.on('pageerror', (error) => errors.push(error.message));
  // Name the failing URL — the console only says "Failed to load resource".
  page.on('response', (response) => {
    const { pathname } = new URL(response.url());

    if (response.status() < 400 || OPTIONAL_FILES.test(pathname)) return;
    errors.push(`${response.status()} ${pathname}`);
  });

  return errors;
};
