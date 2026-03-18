import { cliError } from '@magam/shared';

export interface ParsedCommandOptions {
  positionals: string[];
  flags: Record<string, string | boolean>;
  json: boolean;
}

export interface ParsedBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function parseCommandOptions(args: string[]): ParsedCommandOptions {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }

    flags[key] = next;
    index += 1;
  }

  return {
    positionals,
    flags,
    json: flags['json'] === true,
  };
}

export function hasJsonFlag(args: string[]): boolean {
  return args.includes('--json');
}

export function getStringFlag(
  parsed: ParsedCommandOptions,
  flag: string,
  message?: string,
): string {
  const value = parsed.flags[flag];
  if (typeof value !== 'string' || value.length === 0) {
    throw cliError('INVALID_ARGUMENT', message ?? `--${flag} is required.`, {
      details: { flag },
    });
  }

  return value;
}

export function getOptionalStringFlag(parsed: ParsedCommandOptions, flag: string): string | undefined {
  const value = parsed.flags[flag];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function getBooleanFlag(parsed: ParsedCommandOptions, flag: string): boolean {
  return parsed.flags[flag] === true;
}

export function getOptionalNumberFlag(parsed: ParsedCommandOptions, flag: string): number | undefined {
  const value = parsed.flags[flag];
  if (value === undefined || value === true) {
    return undefined;
  }

  const parsedNumber = Number(value);
  if (!Number.isFinite(parsedNumber)) {
    throw cliError('INVALID_ARGUMENT', `--${flag} must be a number.`, {
      details: { flag, value },
    });
  }

  return parsedNumber;
}

export function getStringListFlag(parsed: ParsedCommandOptions, flag: string): string[] | undefined {
  const value = getOptionalStringFlag(parsed, flag);
  if (!value) {
    return undefined;
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function getBoundsFlag(parsed: ParsedCommandOptions, flag = 'bounds'): ParsedBounds | undefined {
  const value = getOptionalStringFlag(parsed, flag);
  if (!value) {
    return undefined;
  }

  const parts = value.split(',').map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    throw cliError('INVALID_ARGUMENT', `--${flag} must be x,y,width,height.`, {
      details: { flag, value },
    });
  }

  return {
    x: parts[0],
    y: parts[1],
    width: parts[2],
    height: parts[3],
  };
}

export async function readStdinText(): Promise<string> {
  if (process.stdin.isTTY) {
    return '';
  }

  return new Promise<string>((resolve, reject) => {
    const chunks: string[] = [];
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(chunks.join('')));
    process.stdin.on('error', reject);
  });
}

export async function readJsonValue(token: string | undefined, label: string): Promise<unknown> {
  if (!token) {
    throw cliError('INVALID_ARGUMENT', `${label} is required.`, {
      details: { label },
    });
  }

  const source = token === '@stdin' ? await readStdinText() : token;
  if (!source.trim()) {
    throw cliError('INVALID_JSON_INPUT', `${label} must not be empty.`, {
      details: { label },
    });
  }

  try {
    return JSON.parse(source);
  } catch (error) {
    throw cliError('INVALID_JSON_INPUT', `${label} must be valid JSON.`, {
      details: {
        label,
        message: error instanceof Error ? error.message : 'JSON parse failed.',
      },
    });
  }
}
