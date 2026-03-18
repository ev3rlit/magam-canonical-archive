import type {
  PluginNodeRuntimeState,
  PluginRuntimeDiagnostic,
  PluginRuntimeFailureCode,
} from './types';

export function createPluginRuntimeDiagnostic(input: {
  code: PluginRuntimeFailureCode;
  stage: PluginRuntimeDiagnostic['stage'];
  message: string;
  details?: Record<string, unknown>;
}): PluginRuntimeDiagnostic {
  return {
    code: input.code,
    stage: input.stage,
    message: input.message,
    ...(input.details ? { details: input.details } : {}),
    timestamp: Date.now(),
  };
}

export function toPluginRuntimeState(input: {
  status: PluginNodeRuntimeState['status'];
  diagnostic?: PluginRuntimeDiagnostic;
}): PluginNodeRuntimeState {
  return {
    status: input.status,
    ...(input.diagnostic ? { diagnostic: input.diagnostic } : {}),
    updatedAt: Date.now(),
  };
}

export function classifyPluginRuntimeCrash(error: unknown): PluginRuntimeDiagnostic {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : 'Plugin runtime crashed in sandbox.';
  return createPluginRuntimeDiagnostic({
    code: 'PLUGIN_RUNTIME_CRASH',
    stage: 'runtime',
    message,
  });
}

