import { env } from '@/app/config/env';

// Thin server-side client for the Drone CI API. The token never leaves the
// server — the UI talks to our /api/autotests/* routes, which proxy to Drone.

export interface DroneBuild {
  number: number;
  status: string; // pending | running | success | failure | error | killed
  event: string;
  message?: string;
  sender?: string;
  trigger?: string;
  created: number;
  started: number;
  finished: number;
  params?: Record<string, string>;
}

export interface TriggerParams {
  environment: string;
  funnel: string;
  tag: string;
  // A/B forcing (QAA-30): AB_TEST id + comma-separated AB_VARIATION list
  // (e.g. "v0,v1"). Both optional — empty means no A/B override.
  abTest?: string;
  abVariation?: string;
  // Country/locale override (config/locales.ts codes: "US-CA", "DE"); empty =
  // per-device default. NOTE: the autotests .drone.yml must forward LOCALE to
  // the test step for this to take effect.
  locale?: string;
  // Ready-made quiz session URL pointing at one slide, produced by
  // quiz-walker-bot's walkUntil. Only meaningful with tag "@slide-shot" — the
  // slide-screenshot spec skips itself when it's empty.
  slideUrl?: string;
  // Device projects for a slide-shot run: CSV of Playwright project suffixes
  // ("mobile-pixel-7", "mobile-iphone-15-pro"). Empty = the autotests' own
  // default (Pixel/Chrome only). Ignored by every other tag.
  devices?: string;
  // Who triggered the run (logged-in user) — Drone's own `sender` is always the
  // token owner, so we pass this as a custom build param to attribute the run.
  startedBy?: string;
}

export const isDroneConfigured = (): boolean => !!env.DRONE_SERVER && !!env.DRONE_TOKEN && !!env.DRONE_AUTOTESTS_REPO;

export const droneBuildLink = (buildNumber: number): string =>
  `${env.DRONE_SERVER}/${env.DRONE_AUTOTESTS_REPO}/${buildNumber}`;

const droneFetch = async (path: string, init?: RequestInit): Promise<Response> => {
  const response = await fetch(`${env.DRONE_SERVER}/api/repos/${env.DRONE_AUTOTESTS_REPO}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.DRONE_TOKEN}`,
      ...init?.headers,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text();

    throw new Error(`Drone API ${response.status}: ${body.slice(0, 300)}`);
  }

  return response;
};

export const triggerAutotestsBuild = async ({
  environment,
  funnel,
  tag,
  abTest,
  abVariation,
  locale,
  slideUrl,
  devices,
  startedBy,
}: TriggerParams): Promise<DroneBuild> => {
  const query = new URLSearchParams({
    ENVIRONMENT: environment,
    FUNNEL: funnel,
    TAG: tag,
  });

  if (abTest) query.set('AB_TEST', abTest);
  if (abVariation) query.set('AB_VARIATION', abVariation);
  if (locale) query.set('LOCALE', locale);
  if (slideUrl) query.set('SLIDE_URL', slideUrl);
  if (devices) query.set('DEVICES', devices);
  if (startedBy) query.set('STARTED_BY', startedBy);

  const response = await droneFetch(`/builds?${query.toString()}`, { method: 'POST' });

  return response.json();
};

export const listAutotestsBuilds = async (limit = 10, page = 1): Promise<DroneBuild[]> => {
  const response = await droneFetch(`/builds?per_page=${limit}&page=${page}`);

  return response.json();
};

// Cancels a running/pending build (Drone: DELETE /builds/{number}). Drone
// returns 200 with no useful body, so we don't parse it.
export const cancelAutotestsBuild = async (buildNumber: number): Promise<void> => {
  await droneFetch(`/builds/${buildNumber}`, { method: 'DELETE' });
};

// Drone's build-list API has no total count, but the repo object carries
// `counter` — the number of the latest build. Build numbers are sequential,
// so it doubles as an (upper-bound) total for pagination.
export const getAutotestsBuildCount = async (): Promise<number> => {
  const response = await droneFetch('');
  const repo = await response.json();

  return typeof repo?.counter === 'number' ? repo.counter : 0;
};
