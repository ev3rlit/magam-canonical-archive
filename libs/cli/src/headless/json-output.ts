import {
  createFailureEnvelope,
  createSuccessEnvelope,
  toCanonicalCliError,
  type JsonEnvelopeMeta,
} from '@magam/shared';

export interface ResourceCommandResult {
  data: unknown;
  meta?: JsonEnvelopeMeta;
}

export function writeSuccess(result: ResourceCommandResult, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(createSuccessEnvelope(result.data, result.meta), null, 2)}\n`);
    return;
  }

  process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
}

export function writeFailure(error: unknown, json: boolean, meta?: JsonEnvelopeMeta): number {
  const cliError = toCanonicalCliError(error);
  if (json) {
    process.stdout.write(`${JSON.stringify(createFailureEnvelope(cliError, meta), null, 2)}\n`);
  } else {
    process.stderr.write(`${cliError.code}: ${cliError.message}\n`);
  }

  return cliError.exitCode;
}
