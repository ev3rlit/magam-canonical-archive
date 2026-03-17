import {
  type CanonicalCapabilityKey,
  type ContentCapability,
  type ContentKind,
  invalidValidation,
  isContentKind,
  okValidation,
  type ValidationResult,
} from './canonicalObject';

export interface CapabilityDescriptor {
  key: CanonicalCapabilityKey;
  validator: (payload: unknown, path: string) => ValidationResult;
}

const ALLOWED_CAPABILITY_KEYS: readonly CanonicalCapabilityKey[] = [
  'frame',
  'material',
  'texture',
  'attach',
  'ports',
  'bubble',
  'content',
] as const;

const ALLOWED_CAPABILITY_KEY_SET = new Set<string>(ALLOWED_CAPABILITY_KEYS);

const VALID_FIT_VALUES = new Set(['cover', 'contain', 'fill', 'none', 'scale-down']);

const CONTENT_KIND_ALLOWED_FIELDS: Record<ContentKind, readonly string[]> = {
  text: ['value', 'fontSize'],
  markdown: ['source', 'size'],
  media: ['src', 'alt', 'fit', 'width', 'height'],
  sequence: ['participants', 'messages'],
} as const;

const CONTENT_KIND_REQUIRED_FIELDS: Record<ContentKind, readonly string[]> = {
  text: ['value'],
  markdown: ['source'],
  media: ['src'],
  sequence: ['participants', 'messages'],
} as const;

const CONTENT_KIND_ONLY_COMMON_FIELDS = ['kind'];

const buildUnknownPathMessage = (path: string, keys: string[]): string => {
  return `Unknown capability keys detected at ${path}: ${keys.join(', ')}`;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

const isUnknownField = (
  fieldName: string,
  allowed: ReadonlySet<string>,
): boolean => !allowed.has(fieldName);

export const CAPABILITY_REGISTRY: Readonly<Record<CanonicalCapabilityKey, CapabilityDescriptor>> =
  {
    frame: {
      key: 'frame',
      validator: (payload, path) => {
        if (!isRecord(payload)) {
          return invalidValidation(
            'INVALID_CAPABILITY_PAYLOAD',
            'frame capability must be an object.',
            path,
          );
        }

        if (!('shape' in payload) && !('fill' in payload) && !('stroke' in payload) && !('strokeWidth' in payload)) {
          return invalidValidation(
            'INVALID_CAPABILITY_PAYLOAD',
            'frame capability must define at least one visual field.',
            path,
          );
        }

        if ('shape' in payload && !isString(payload.shape)) {
          return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'frame.shape must be a string.', `${path}.shape`);
        }
        if ('fill' in payload && !isString(payload.fill)) {
          return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'frame.fill must be a string.', `${path}.fill`);
        }
        if ('stroke' in payload && !isString(payload.stroke)) {
          return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'frame.stroke must be a string.', `${path}.stroke`);
        }
        if ('strokeWidth' in payload && !isNumber(payload.strokeWidth)) {
          return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'frame.strokeWidth must be a number.', `${path}.strokeWidth`);
        }

        return okValidation();
      },
    },
    material: {
      key: 'material',
      validator: (payload, path) => {
        if (!isRecord(payload)) {
          return invalidValidation(
            'INVALID_CAPABILITY_PAYLOAD',
            'material capability must be an object.',
            path,
          );
        }
        if ('preset' in payload && !isString(payload.preset)) {
          return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'material.preset must be a string.', `${path}.preset`);
        }
        return okValidation();
      },
    },
    texture: {
      key: 'texture',
      validator: (payload, path) => {
        if (!isRecord(payload)) {
          return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'texture capability must be an object.', path);
        }
        if ('noiseOpacity' in payload && !isNumber(payload.noiseOpacity)) {
          return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'texture.noiseOpacity must be a number.', `${path}.noiseOpacity`);
        }
        if ('glossOpacity' in payload && !isNumber(payload.glossOpacity)) {
          return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'texture.glossOpacity must be a number.', `${path}.glossOpacity`);
        }
        return okValidation();
      },
    },
    attach: {
      key: 'attach',
      validator: (payload, path) => {
        if (!isRecord(payload)) {
          return invalidValidation(
            'INVALID_CAPABILITY_PAYLOAD',
            'attach capability must be an object.',
            path,
          );
        }
        if ('target' in payload && !isString(payload.target)) {
          return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'attach.target must be a string.', `${path}.target`);
        }
        if ('position' in payload && !isString(payload.position)) {
          return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'attach.position must be a string.', `${path}.position`);
        }
        if ('offset' in payload && !isNumber(payload.offset)) {
          return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'attach.offset must be a number.', `${path}.offset`);
        }
        return okValidation();
      },
    },
    ports: {
      key: 'ports',
      validator: (payload, path) => {
        if (!isRecord(payload)) {
          return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'ports capability must be an object.', path);
        }
        if (!Array.isArray(payload.ports)) {
          return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'ports.ports must be an array.', `${path}.ports`);
        }
        return okValidation();
      },
    },
    bubble: {
      key: 'bubble',
      validator: (payload, path) => {
        if (!isRecord(payload)) {
          return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'bubble capability must be an object.', path);
        }
        if (!('bubble' in payload) || !isBoolean(payload.bubble)) {
          return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'bubble.bubble must be a boolean.', `${path}.bubble`);
        }
        return okValidation();
      },
    },
    content: {
      key: 'content',
      validator: (payload, path) => {
        const contentValidation = validateContentKindExclusivity(payload, path);
        if (!contentValidation.ok) {
          return contentValidation;
        }

        if (!isRecord(payload)) {
          return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'content capability must be an object.', path);
        }

        const casted = payload as Partial<ContentCapability>;
        if (casted.kind === 'text') {
          if (!isString(casted.value)) {
            return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'content.value must be a string.', `${path}.value`);
          }
          if ('fontSize' in casted && !isNumber(casted.fontSize) && !isString(casted.fontSize)) {
            return invalidValidation(
              'INVALID_CAPABILITY_PAYLOAD',
              'content.fontSize must be a string or number.',
              `${path}.fontSize`,
            );
          }
        }

        if (casted.kind === 'markdown') {
          if (!isString(casted.source)) {
            return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'content.source must be a string.', `${path}.source`);
          }
        }

        if (casted.kind === 'media') {
          if (!isString(casted.src)) {
            return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'content.src must be a string.', `${path}.src`);
          }
          if ('alt' in casted && !isString(casted.alt)) {
            return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'content.alt must be a string.', `${path}.alt`);
          }
          if ('fit' in casted && !(isString(casted.fit) && VALID_FIT_VALUES.has(casted.fit))) {
            return invalidValidation(
              'INVALID_CAPABILITY_PAYLOAD',
              `content.fit must be one of ${Array.from(VALID_FIT_VALUES).join(', ')}.`,
              `${path}.fit`,
            );
          }
          if ('width' in casted && !isNumber(casted.width)) {
            return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'content.width must be a number.', `${path}.width`);
          }
          if ('height' in casted && !isNumber(casted.height)) {
            return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'content.height must be a number.', `${path}.height`);
          }
        }

        if (casted.kind === 'sequence') {
          if (!Array.isArray(casted.participants)) {
            return invalidValidation(
              'INVALID_CAPABILITY_PAYLOAD',
              'content.participants must be an array.',
              `${path}.participants`,
            );
          }
          if (!Array.isArray(casted.messages)) {
            return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'content.messages must be an array.', `${path}.messages`);
          }
        }

        return okValidation();
      },
    },
  };

export function getAllowedCapabilityKeys(): readonly CanonicalCapabilityKey[] {
  return ALLOWED_CAPABILITY_KEYS;
}

export function isCapabilityKey(value: unknown): value is CanonicalCapabilityKey {
  return typeof value === 'string' && ALLOWED_CAPABILITY_KEY_SET.has(value);
}

export function getUnknownCapabilityKeys(capabilities: unknown): string[] {
  if (!isRecord(capabilities)) {
    return [];
  }

  return Object.keys(capabilities).filter((key) => !ALLOWED_CAPABILITY_KEY_SET.has(key));
}

export function validateUnknownCapabilityKeys(capabilities: unknown, path = 'capabilities'): ValidationResult {
  const unknownKeys = getUnknownCapabilityKeys(capabilities);
  if (unknownKeys.length === 0) {
    return okValidation();
  }

  return invalidValidation('INVALID_CAPABILITY', buildUnknownPathMessage(path, unknownKeys), path);
}

export function validateCapabilityPayload(
  key: CanonicalCapabilityKey,
  payload: unknown,
  path = 'capabilities',
): ValidationResult {
  return CAPABILITY_REGISTRY[key].validator(payload, path ? `${path}.${key}` : key);
}

export function validateCapabilityBag(
  capabilities: unknown,
  path = 'capabilities',
): ValidationResult {
  if (!isRecord(capabilities)) {
    return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'capabilities must be an object.', path);
  }

  const unknownValidation = validateUnknownCapabilityKeys(capabilities, path);
  if (!unknownValidation.ok) {
    return unknownValidation;
  }

  for (const key of Object.keys(capabilities) as CanonicalCapabilityKey[]) {
    const validation = validateCapabilityPayload(key, capabilities[key], path);
    if (!validation.ok) {
      return validation;
    }
  }

  return okValidation();
}

export function validateContentKindExclusivity(content: unknown, path = 'capabilities.content'):
  ValidationResult {
  if (!isRecord(content)) {
    return invalidValidation('INVALID_CAPABILITY_PAYLOAD', 'content capability must be an object.', path);
  }

  if (!('kind' in content)) {
    return invalidValidation(
      'CONTENT_CONTRACT_VIOLATION',
      'content object must declare a kind.',
      `${path}.kind`,
    );
  }

  if (!isContentKind(content.kind)) {
    return invalidValidation(
      'CONTENT_CONTRACT_VIOLATION',
      `content.kind must be one of text|markdown|media|sequence.`,
      `${path}.kind`,
    );
  }

  const declaredKind = content.kind;
  const declaredAllowed = new Set(
    CONTENT_KIND_ONLY_COMMON_FIELDS.concat(CONTENT_KIND_ALLOWED_FIELDS[declaredKind]),
  );

  const unknownField = Object.keys(content).find((fieldName) => isUnknownField(fieldName, declaredAllowed));
  if (unknownField) {
    return invalidValidation(
      'CONTENT_CONTRACT_VIOLATION',
      `content.${declaredKind} payload contains unsupported field: ${unknownField}`,
      `${path}.${unknownField}`,
    );
  }

  for (const requiredField of CONTENT_KIND_REQUIRED_FIELDS[declaredKind]) {
    if (!(requiredField in content)) {
      return invalidValidation(
        'CONTENT_CONTRACT_VIOLATION',
        `content.${declaredKind} payload requires ${requiredField}.`,
        `${path}.${requiredField}`,
      );
    }
  }

  return okValidation();
}
