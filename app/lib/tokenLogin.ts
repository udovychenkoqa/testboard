// Signing in with the API token grants admin, and the same token sits in the autotests' CI variables.
// So once Google sign-in exists the token stops opening the UI; AUTH_TOKEN_LOGIN brings it back as a
// break-glass path (e.g. a broken OAuth client). CI uploads use the Authorization header and are unaffected.
export const isTokenLoginEnabled = ({
  hasApiToken,
  googleEnabled,
  forced,
}: {
  hasApiToken: boolean;
  googleEnabled: boolean;
  forced: boolean;
}): boolean => hasApiToken && (!googleEnabled || forced);
