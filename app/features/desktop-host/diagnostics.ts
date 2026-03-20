export interface DesktopHostLogger {
  error: (message: string, details?: unknown) => void;
  info: (message: string, details?: unknown) => void;
  warn: (message: string, details?: unknown) => void;
}

function write(level: 'error' | 'info' | 'warn', scope: string, message: string, details?: unknown) {
  const formatted = `[${scope}] ${message}`;
  if (details === undefined) {
    console[level](formatted);
    return;
  }
  console[level](formatted, details);
}

export function createDesktopHostLogger(scope: string): DesktopHostLogger {
  return {
    error(message, details) {
      write('error', scope, message, details);
    },
    info(message, details) {
      write('info', scope, message, details);
    },
    warn(message, details) {
      write('warn', scope, message, details);
    },
  };
}
