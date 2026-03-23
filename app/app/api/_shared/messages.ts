export const API_SHARED_MESSAGES = {
  unknownError: 'Unknown error',
  invalidJsonBody: 'Request body must be a JSON object.',
} as const;

export function formatApiRequestFailure(scope: string, message: string): string {
  return `Failed to handle ${scope} request: ${message}`;
}
