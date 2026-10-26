import { redisCacheService } from './redis-cache.service';

/** Clear cached login aliases after credential, role, or account-state changes. */
export async function invalidateAuthLookupCache(): Promise<void> {
  if (typeof redisCacheService.deleteByPrefix === 'function') {
    await redisCacheService.deleteByPrefix('auth:v2:user:');
  }
}
