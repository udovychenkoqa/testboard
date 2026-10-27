// Edge-safe constant-time string compare (node:crypto is unavailable in middleware).
// Length is allowed to leak; the content comparison does not short-circuit.
export const safeEqual = (a: string, b: string): boolean => {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;

  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }

  return diff === 0;
};

export const isAuthorized = ({
  actualAuthToken,
  expectedAuthToken,
}: {
  actualAuthToken: string | null;
  expectedAuthToken: string;
}) => actualAuthToken !== null && safeEqual(actualAuthToken, expectedAuthToken);
