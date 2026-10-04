import pino from 'pino';
import { getConfig } from './config.js';

const config = getConfig();

export const logger = pino({
  level: config.logLevel,
  redact: {
    paths: [
      'authorization', 'Authorization', 'cookie', 'cookies', 'set-cookie',
      '*.authorization', '*.Authorization', '*.cookie', '*.cookies', '*.set-cookie',
      '*.password', '*.secret', '*.token', '*.api_key', '*.apiKey', '*.accessKeyId',
      '*.secretAccessKey', '*.storageState', '*.account_email', '*.email',
      'req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'
    ],
    censor: '[REDACTED]'
  },
  base: {
    service: 'ai-visibility-growth-loop'
  }
});
