import { redisCacheService } from './redis-cache.service';

const GLOBAL_FORCE_LOGOUT_KEY = 'auth:global_force_logout_after';
const REFRESH_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const ACCESS_TOKEN_GRACE_SECONDS = 60 * 60;
const GLOBAL_FORCE_LOGOUT_TTL_SECONDS = REFRESH_TOKEN_MAX_AGE_SECONDS + ACCESS_TOKEN_GRACE_SECONDS;

type IssuedTokenPayload = {
  iat?: number;
};

export async function markGlobalForceLogout(): Promise<number> {
  const forcedAfter = Date.now();
  await redisCacheService.set(
    GLOBAL_FORCE_LOGOUT_KEY,
    forcedAfter.toString(),
    GLOBAL_FORCE_LOGOUT_TTL_SECONDS
  );

  const persistedValue = await redisCacheService.get<string | number>(GLOBAL_FORCE_LOGOUT_KEY);
  if (Number(persistedValue) !== forcedAfter) {
    throw new Error('Global force logout marker could not be persisted');
  }

  return forcedAfter;
}

export async function isTokenGloballyInvalidated(payload: IssuedTokenPayload): Promise<boolean> {
  const forcedAfter = await redisCacheService.get<string | number>(GLOBAL_FORCE_LOGOUT_KEY);
  if (!forcedAfter || !payload?.iat) return false;

  const forcedAfterMs = Number(forcedAfter);
  const issuedAtMs = payload.iat * 1000;

  return Number.isFinite(forcedAfterMs) && issuedAtMs < forcedAfterMs;
}
