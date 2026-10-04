import Redis from 'ioredis';
import { getConfig } from './config.js';

const config = getConfig();

export function createRedisClient() {
  return new Redis(config.redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false
  });
}

export async function pingRedis(redis) {
  return redis.ping();
}
