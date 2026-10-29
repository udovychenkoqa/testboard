// The PDF exporters point server-side Chromium at this app's own /api/serve. The origin must not come
// straight from request headers (Host / X-Forwarded-Proto): a forged value would turn the export into a
// fetch of an arbitrary URL, `file://` included. Only hosts the deployment already names are trusted.
const trustedHosts = (): Set<string> => {
  const hosts = new Set<string>(['localhost', '127.0.0.1']);

  for (const raw of [process.env.AUTH_URL, process.env.NEXTAUTH_URL]) {
    try {
      if (raw) hosts.add(new URL(raw).host.toLowerCase());
    } catch {
      // ignore a malformed URL; the localhost fallback still works
    }
  }

  return hosts;
};

export const resolveRenderOrigin = (headers: Headers): { origin: string; hostname: string } => {
  const fallbackHost = `localhost:${process.env.PORT || 3000}`;
  const requestedHost = (headers.get('host') ?? '').toLowerCase();
  const requestedProto = headers.get('x-forwarded-proto');
  const proto = requestedProto === 'https' ? 'https' : 'http';

  const hostAllowed = trustedHosts().has(requestedHost) || trustedHosts().has(requestedHost.split(':')[0]);
  const host = hostAllowed && /^[a-z0-9.-]+(:\d{1,5})?$/.test(requestedHost) ? requestedHost : fallbackHost;

  return { origin: `${host === fallbackHost ? 'http' : proto}://${host}`, hostname: host.split(':')[0] };
};
