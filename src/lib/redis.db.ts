/* @typescript-eslint/no-non-null-assertion */

import { BaseRedisStorage } from './redis-base.db';

export class RedisStorage extends BaseRedisStorage {
  constructor() {
    const config = {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      clientName: 'Redis',
    };
    const globalSymbol = Symbol.for('__VIDORA_REDIS_CLIENT__');
    super(config, globalSymbol);
  }
}
