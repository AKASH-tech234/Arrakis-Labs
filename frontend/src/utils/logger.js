/**
 * Centralized frontend logger utility.
 *
 * In development mode (import.meta.env.DEV), all log methods forward to the
 * native console.  In production builds Vite statically replaces
 * `import.meta.env.DEV` with `false`, so the entire body of every method
 * becomes dead-code and is removed by tree-shaking / minification.
 *
 * Usage:
 *   import logger from "@/utils/logger";   // or relative path
 *   logger.log("[MyComponent] loaded");
 *   logger.error("[MyComponent] failed", err);
 */

const noop = () => {};

const logger = {
  log: import.meta.env.DEV ? (...args) => console.log(...args) : noop,

  info: import.meta.env.DEV ? (...args) => console.info(...args) : noop,

  warn: import.meta.env.DEV ? (...args) => console.warn(...args) : noop,

  error: import.meta.env.DEV ? (...args) => console.error(...args) : noop,

  debug: import.meta.env.DEV ? (...args) => console.debug(...args) : noop,
};

export default logger;
