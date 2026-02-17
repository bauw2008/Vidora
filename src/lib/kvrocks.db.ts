/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { BaseRedisStorage } from './redis-base.db';

export class KvrocksStorage extends BaseRedisStorage {
  constructor() {
    const config = {
      url: process.env.KVROCKS_URL!,
      clientName: 'Kvrocks',
    };
    const globalSymbol = Symbol.for('__VIDORA_KVROCKS_CLIENT__');
    super(config, globalSymbol);
  }
}
