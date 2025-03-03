import pino from 'pino';
import config from '../config/config';

// Configure logger
const logger = pino({
  level: config.logging.level,
  transport: config.logging.format === 'pretty' 
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    }
  },
  base: {
    service: 'recording'
  },
  timestamp: () => `,"time":"${new Date().toISOString()}"`
});

export default logger;