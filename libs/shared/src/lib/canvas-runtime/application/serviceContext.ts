import { randomUUID } from 'node:crypto';
import type { HeadlessServiceContext } from '../../canonical-cli';
import type { CanvasRuntimeRepositoryPort } from './repositoryPorts';
import { createCanvasRuntimeRepositoryAdapter } from './repositoryAdapter';

export interface CanvasRuntimeServiceContext {
  headless: HeadlessServiceContext;
  repository: CanvasRuntimeRepositoryPort;
  createId: () => string;
  now: () => Date;
}

export function createCanvasRuntimeServiceContext(
  headless: HeadlessServiceContext,
): CanvasRuntimeServiceContext {
  return {
    headless,
    repository: createCanvasRuntimeRepositoryAdapter(headless),
    createId: () => randomUUID(),
    now: () => new Date(),
  };
}
