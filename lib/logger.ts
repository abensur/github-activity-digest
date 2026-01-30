import { createConsola } from 'consola';

export const logger = createConsola({
  level: process.env.LOG_LEVEL ? parseInt(process.env.LOG_LEVEL, 10) : 3,
  formatOptions: {
    colors: true,
    date: false,
    compact: false
  }
});

export default logger;
