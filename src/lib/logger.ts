/**
 * @description Logger leve com toggle dev/prod. Em produção, `info`/`debug` são silenciados;
 * `warn` e `error` permanecem para diagnóstico. Centraliza a saída para permitir, no futuro,
 * encaminhar a um sink remoto (Sentry, etc.) sem tocar nos call-sites.
 */
const isDev =
  (typeof import.meta !== "undefined" && (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true) ||
  (typeof process !== "undefined" && process.env?.NODE_ENV !== "production");

type LogArgs = readonly unknown[];

export const logger = {
  debug: (...args: LogArgs) => {
    if (isDev) console.debug(...args);
  },
  info: (...args: LogArgs) => {
    if (isDev) console.info(...args);
  },
  warn: (...args: LogArgs) => {
    console.warn(...args);
  },
  error: (...args: LogArgs) => {
    console.error(...args);
  },
};
