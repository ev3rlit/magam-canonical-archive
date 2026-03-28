export const WS_RPC_MESSAGES = {
  parseError: 'Parse error',
  invalidRequest: 'Invalid Request',
  methodNotFound: 'Method not found',
  internalError: 'Internal error',
} as const;

export const WS_SERVER_MESSAGES = {
  serverBanner: 'Magam File Sync Server (JSON-RPC 2.0)',
  starting: (port: number) => `[WS] Starting JSON-RPC WebSocket server on port ${port}...`,
  clientConnected: (count: number) => `[WS] Client connected. Total: ${count}`,
  notificationReceived: (method: string) => `[WS] Received notification: ${method}`,
  clientDisconnected: (count: number) => `[WS] Client disconnected. Total: ${count}`,
  runningAt: (port: number) => `[WS] Server running at ws://localhost:${port}`,
  broadcastCanvasChanged: (canvasId: string) => `[WS] Broadcasted canvas.changed: ${canvasId}`,
  notifiedClientAbout: (subscription: string) => `[WS] Notified client about: ${subscription}`,
  shuttingDown: '\n[WS] Shutting down...',
} as const;

export const WS_PATCHER_MESSAGES = {
  imageContentPatchOnly: 'media content fields are only valid for Image nodes.',
  markdownSourcePatchOnly: 'markdown source fields are only valid for Markdown nodes.',
  sequenceContentPatchOnly: 'sequence content fields are only valid for Sequence nodes.',
} as const;
