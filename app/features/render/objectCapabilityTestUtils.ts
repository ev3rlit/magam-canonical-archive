import type {
  CanonicalCapabilityKey,
  CanonicalObject,
  CanonicalValidationCode,
  NormalizationSource,
  ValidationResult,
} from './canonicalObject';

export type CanonicalObjectExpectation = {
  semanticRole?: CanonicalObject['semanticRole'];
  alias?: CanonicalObject['alias'];
  capabilities?: Partial<CanonicalObject['capabilities']>;
  capabilitySources?: Partial<Record<CanonicalCapabilityKey, NormalizationSource>>;
  forbidCapabilities?: readonly CanonicalCapabilityKey[];
};

export type CanonicalValidationExpectation = Pick<ValidationResult, 'code' | 'path' | 'message'> & {
  ok: false;
};

export type CanonicalAssertionResult = {
  pass: boolean;
  mismatches: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isArray = (value: unknown): value is unknown[] => Array.isArray(value);

const matchesSubset = (actual: unknown, expected: unknown, path = ''): string[] => {
  if (expected === undefined) {
    return [];
  }

  if (expected === null || actual === null) {
    return expected === actual ? [] : [`${path || 'value'} expected ${String(expected)} but got ${String(actual)}`];
  }

  if (isArray(expected)) {
    if (!isArray(actual) || actual.length < expected.length) {
      return [`${path || 'value'} expected array prefix but got ${typeof actual}`];
    }
    return expected.flatMap((entry, index) => matchesSubset(actual[index], entry, `${path}[${index}]`));
  }

  if (typeof expected === 'object') {
    if (!isRecord(actual)) {
      return [`${path || 'value'} expected object but got ${typeof actual}`];
    }
    return Object.entries(expected).flatMap(([key, expectedValue]) => {
      const nextPath = path ? `${path}.${key}` : key;
      return matchesSubset(actual[key], expectedValue, nextPath);
    });
  }

  return Object.is(actual, expected)
    ? []
    : [`${path || 'value'} expected ${String(expected)} but got ${String(actual)}`];
};

export const collectCanonicalMismatches = (
  actual: unknown,
  expected: CanonicalObjectExpectation,
): string[] => {
  if (!isRecord(actual)) {
    return ['actualCanonical must be an object'];
  }

  const canonical = actual as CanonicalObject;
  const mismatches: string[] = [];

  if (expected.semanticRole !== undefined && canonical.semanticRole !== expected.semanticRole) {
    mismatches.push(
      `semanticRole expected "${expected.semanticRole}" but got "${canonical.semanticRole}"`,
    );
  }

  if (expected.alias !== undefined && canonical.alias !== expected.alias) {
    mismatches.push(`alias expected "${expected.alias}" but got "${canonical.alias}"`);
  }

  mismatches.push(...matchesSubset(canonical.capabilities, expected.capabilities, 'capabilities'));
  mismatches.push(...matchesSubset(canonical.capabilitySources, expected.capabilitySources, 'capabilitySources'));

  if (expected.forbidCapabilities?.length) {
    expected.forbidCapabilities.forEach((capability) => {
      if (canonical.capabilities?.[capability] != null) {
        mismatches.push(`capabilities.${capability} was expected to be absent`);
      }
    });
  }

  return mismatches;
};

export const collectValidationMismatches = (
  actual: ValidationResult,
  expected: CanonicalValidationExpectation,
): string[] => {
  if (actual.ok !== expected.ok) {
    return [`ok expected ${expected.ok} but got ${actual.ok}`];
  }

  if (actual.code !== expected.code) {
    return [`code expected "${expected.code}" but got "${actual.code}"`];
  }

  if (expected.path && actual.path !== expected.path) {
    return [`path expected "${expected.path}" but got "${actual.path}"`];
  }

  if (expected.message && actual.message && !actual.message.includes(expected.message)) {
    return [
      `message expected to include "${expected.message}" but got "${actual.message}"`,
    ];
  }

  return [];
};

export const collectCanonicalAssertion = (
  actual: unknown,
  expectedObject?: CanonicalObjectExpectation,
  expectedValidation?: CanonicalValidationExpectation,
): CanonicalAssertionResult => {
  const mismatches: string[] = [];

  if (expectedObject) {
    mismatches.push(...collectCanonicalMismatches(actual, expectedObject));
  }

  if (expectedValidation && actual && typeof actual === 'object') {
    mismatches.push(...collectValidationMismatches(actual as ValidationResult, expectedValidation));
  }

  return { pass: mismatches.length === 0, mismatches };
};

export const assertCanonicalMatch = (
  actual: unknown,
  expectedObject: CanonicalObjectExpectation,
): void => {
  const result = collectCanonicalAssertion(actual, expectedObject);
  if (!result.pass) {
    throw new Error(`Canonical assertion failed:\\n${result.mismatches.join('\\n')}`);
  }
};

export const assertCanonicalValidationFailure = (
  actual: ValidationResult,
  expected: CanonicalValidationExpectation,
): void => {
  const result = collectValidationMismatches(actual, expected);
  if (result.length > 0) {
    throw new Error(`Validation assertion failed:\\n${result.join('\\n')}`);
  }
};

export const isValidationFailure = (value: unknown): value is ValidationResult =>
  isRecord(value) && value.ok === false;

export const isContentKindValidation = (value: ValidationResult, code: CanonicalValidationCode): boolean =>
  value.ok === false && value.code === code;
