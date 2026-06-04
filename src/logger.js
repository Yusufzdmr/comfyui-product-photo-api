/**
 * Minimal, bagimliliksiz logger. Renkli ve zaman damgali ciktilar uretir.
 */
const COLORS = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function ts() {
  // ISO zaman damgasi (saniye hassasiyeti yeterli)
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function emit(color, level, args) {
  const prefix = `${COLORS.gray}${ts()}${COLORS.reset} ${color}[${level}]${COLORS.reset}`;
  console.log(prefix, ...args);
}

export const logger = {
  info: (...a) => emit(COLORS.blue, 'INFO', a),
  success: (...a) => emit(COLORS.green, 'OK', a),
  warn: (...a) => emit(COLORS.yellow, 'WARN', a),
  error: (...a) => emit(COLORS.red, 'ERR', a),
  step: (...a) => emit(COLORS.gray, '..', a),
};

export default logger;
