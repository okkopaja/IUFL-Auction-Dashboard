export const logger = {
  error: (msg: string, err?: any) => {
    console.error(`[ERROR] ${new Date().toISOString()}: ${msg}`, err || "");
    // Future integration point for services like Sentry/Datadog
  },
  info: (msg: string, ...args: any[]) => {
    console.log(`[INFO] ${new Date().toISOString()}: ${msg}`, ...args);
  },
  warn: (msg: string, ...args: any[]) => {
    console.warn(`[WARN] ${new Date().toISOString()}: ${msg}`, ...args);
  },
};
