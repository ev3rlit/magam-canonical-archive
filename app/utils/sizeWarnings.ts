export type SizeWarningCode =
  | 'UNSUPPORTED_TOKEN'
  | 'UNSUPPORTED_RATIO'
  | 'CONFLICTING_SIZE_INPUT'
  | 'UNSUPPORTED_LEGACY_SIZE_API';

export interface SizeWarningEvent {
  code: SizeWarningCode;
  component: string;
  inputPath: string;
  fallbackApplied: string;
}

export function emitSizeWarning(event: SizeWarningEvent): void {
  const { code, component, inputPath, fallbackApplied } = event;
  console.warn(
    `[Size:${code}] component="${component}" input="${inputPath}" fallback="${fallbackApplied}"`,
  );
}

