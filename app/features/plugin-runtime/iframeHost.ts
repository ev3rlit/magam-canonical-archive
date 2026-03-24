import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ensureHostApiAllowed } from './capabilityGate';
import { createPluginRuntimeDiagnostic } from './fallback';
import {
  createPluginBridgeResponse,
  isPluginBridgeInboundMessage,
  isPluginBridgeRequest,
} from './bridge';
import {
  PLUGIN_RUNTIME_BRIDGE_CHANNEL,
  type PluginExportDescriptor,
  type PluginInstanceConfig,
  type PluginNodeRuntimeState,
  type PluginRuntimeDiagnostic,
} from './types';

function escapeClosingScriptTag(source: string): string {
  return source.replace(/<\/script>/gi, '<\\/script>');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toRuntimeErrorPayload(diagnostic: PluginRuntimeDiagnostic): {
  code: PluginRuntimeDiagnostic['code'];
  message: string;
  details?: Record<string, unknown>;
} {
  return {
    code: diagnostic.code,
    message: diagnostic.message,
    ...(diagnostic.details ? { details: diagnostic.details } : {}),
  };
}

export function createPluginIframeDocument(input: {
  descriptor: PluginExportDescriptor;
  instance: PluginInstanceConfig;
}): string {
  const rendered = input.descriptor.render({ instance: input.instance });
  const serializedInstance = JSON.stringify(input.instance);
  const css = rendered.css ?? '';
  const html = rendered.html ?? '';
  const script = rendered.script ?? '';

  const bootstrapScript = `
(function bootstrapMagamPluginRuntime() {
  const CHANNEL = ${JSON.stringify(PLUGIN_RUNTIME_BRIDGE_CHANNEL)};
  const instance = ${serializedInstance};
  let requestSeq = 0;
  const pending = new Map();

  function postToHost(message) {
    window.parent.postMessage({ channel: CHANNEL, ...message }, '*');
  }

  function requestHost(api, payload) {
    const requestId = 'req-' + (++requestSeq);
    postToHost({ kind: 'plugin.request', requestId, api, payload });
    return new Promise((resolve, reject) => {
      pending.set(requestId, { resolve, reject });
      setTimeout(() => {
        if (!pending.has(requestId)) {
          return;
        }
        pending.delete(requestId);
        reject(new Error('Host request timeout: ' + api));
      }, 2000);
    });
  }

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.channel !== CHANNEL || data.kind !== 'host.response') {
      return;
    }
    const entry = pending.get(data.requestId);
    if (!entry) {
      return;
    }
    pending.delete(data.requestId);
    if (data.ok) {
      entry.resolve(data.payload);
      return;
    }
    entry.reject(new Error(data.error?.message || 'Host request failed'));
  });

  window.MagamHost = {
    queryObjects: (payload) => requestHost('queryObjects', payload),
    getObject: (payload) => requestHost('getObject', payload),
    getSelection: () => requestHost('getSelection'),
    updateInstanceProps: (payload) => requestHost('updateInstanceProps', payload),
    emitAction: (payload) => requestHost('emitAction', payload),
    requestResize: (payload) => requestHost('requestResize', payload),
  };
  window.__MAGAM_INSTANCE__ = instance;

  postToHost({ kind: 'plugin.ready' });

  try {
    ${escapeClosingScriptTag(script)}
  } catch (error) {
    postToHost({
      kind: 'plugin.crash',
      message: error instanceof Error ? error.message : String(error),
    });
  }
})();
`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    :root { color-scheme: light; }
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; }
    #plugin-root { box-sizing: border-box; width: 100%; min-height: 100%; }
    ${css}
  </style>
</head>
<body>
  <div id="plugin-root">${html}</div>
  <script>
    ${escapeClosingScriptTag(bootstrapScript)}
  </script>
</body>
</html>`;
}

export interface UsePluginIframeRuntimeInput {
  nodeId: string;
  descriptor: PluginExportDescriptor;
  instance: PluginInstanceConfig;
  onPatchInstanceProps?: (patch: Record<string, unknown>) => void;
  onDiagnostic?: (diagnostic: PluginRuntimeDiagnostic) => void;
  getHostObjects?: () => Array<Record<string, unknown>>;
  getHostObjectById?: (id: string) => Record<string, unknown> | null;
  getSelection?: () => string[];
}

export interface PluginIframeRuntime {
  iframeRef: { current: HTMLIFrameElement | null };
  srcDoc: string;
  iframeHeight: number;
  runtimeState: PluginNodeRuntimeState;
}

export function usePluginIframeRuntime(input: UsePluginIframeRuntimeInput): PluginIframeRuntime {
  const {
    nodeId,
    descriptor,
    instance,
    onPatchInstanceProps,
    onDiagnostic,
    getHostObjects,
    getHostObjectById,
    getSelection,
  } = input;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(220);
  const [runtimeState, setRuntimeState] = useState<PluginNodeRuntimeState>({
    status: 'loading',
    updatedAt: Date.now(),
  });

  const srcDoc = useMemo(() => (
    createPluginIframeDocument({
      descriptor,
      instance,
    })
  ), [descriptor, instance]);

  const commitDiagnostic = useCallback((diagnostic: PluginRuntimeDiagnostic, status: PluginNodeRuntimeState['status']) => {
    setRuntimeState({
      status,
      diagnostic,
      updatedAt: Date.now(),
    });
    onDiagnostic?.(diagnostic);
  }, [onDiagnostic]);

  useEffect(() => {
    setRuntimeState({
      status: 'loading',
      updatedAt: Date.now(),
    });
    setIframeHeight(220);
  }, [srcDoc]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (!iframeRef.current?.contentWindow || event.source !== iframeRef.current.contentWindow) {
        return;
      }
      if (!isPluginBridgeInboundMessage(event.data)) {
        return;
      }

      if (event.data.kind === 'plugin.ready') {
        setRuntimeState({
          status: 'ready',
          updatedAt: Date.now(),
        });
        return;
      }

      if (event.data.kind === 'plugin.crash') {
        commitDiagnostic(createPluginRuntimeDiagnostic({
          code: 'PLUGIN_RUNTIME_CRASH',
          stage: 'runtime',
          message: event.data.message || `Plugin ${instance.instanceId} crashed in iframe runtime.`,
          details: {
            nodeId,
            instanceId: instance.instanceId,
          },
        }), 'crashed');
        return;
      }

      if (!isPluginBridgeRequest(event.data)) {
        return;
      }

      const request = event.data;
      const capabilityFailure = ensureHostApiAllowed({
        api: request.api,
        declaredCapabilities: instance.capabilities,
      });

      if (capabilityFailure) {
        const failureResponse = createPluginBridgeResponse({
          requestId: request.requestId,
          ok: false,
          error: toRuntimeErrorPayload(capabilityFailure),
        });
        iframeRef.current.contentWindow.postMessage(failureResponse, '*');
        commitDiagnostic(capabilityFailure, 'crashed');
        return;
      }

      const respond = (response: ReturnType<typeof createPluginBridgeResponse>) => {
        iframeRef.current?.contentWindow?.postMessage(response, '*');
      };

      const parsePatchPayload = (payload: unknown): Record<string, unknown> | null => {
        if (!isRecord(payload) || !isRecord(payload.patch)) {
          return null;
        }
        return payload.patch;
      };

      switch (request.api) {
        case 'queryObjects': {
          respond(createPluginBridgeResponse({
            requestId: request.requestId,
            ok: true,
            payload: getHostObjects?.() ?? [],
          }));
          return;
        }
        case 'getObject': {
          const objectId = isRecord(request.payload) && typeof request.payload.id === 'string'
            ? request.payload.id
            : null;
          respond(createPluginBridgeResponse({
            requestId: request.requestId,
            ok: true,
            payload: objectId ? (getHostObjectById?.(objectId) ?? null) : null,
          }));
          return;
        }
        case 'getSelection': {
          respond(createPluginBridgeResponse({
            requestId: request.requestId,
            ok: true,
            payload: getSelection?.() ?? [],
          }));
          return;
        }
        case 'emitAction': {
          respond(createPluginBridgeResponse({
            requestId: request.requestId,
            ok: true,
            payload: {
              accepted: true,
              action: request.payload,
            },
          }));
          return;
        }
        case 'updateInstanceProps': {
          const patch = parsePatchPayload(request.payload);
          if (!patch) {
            const invalidRequest = createPluginBridgeResponse({
              requestId: request.requestId,
              ok: false,
              error: {
                code: 'PLUGIN_REQUEST_INVALID',
                message: 'updateInstanceProps requires payload.patch object.',
              },
            });
            respond(invalidRequest);
            return;
          }

          onPatchInstanceProps?.(patch);
          respond(createPluginBridgeResponse({
            requestId: request.requestId,
            ok: true,
            payload: {
              updated: true,
            },
          }));
          return;
        }
        case 'requestResize': {
          const requestedHeight = (
            isRecord(request.payload) && typeof request.payload.height === 'number'
              ? request.payload.height
              : null
          );
          if (requestedHeight !== null && Number.isFinite(requestedHeight)) {
            const nextHeight = Math.min(1600, Math.max(80, Math.round(requestedHeight)));
            setIframeHeight(nextHeight);
            respond(createPluginBridgeResponse({
              requestId: request.requestId,
              ok: true,
              payload: { height: nextHeight },
            }));
            return;
          }
          respond(createPluginBridgeResponse({
            requestId: request.requestId,
            ok: true,
            payload: { height: iframeHeight },
          }));
          return;
        }
        default: {
          const unsupportedApi = createPluginRuntimeDiagnostic({
            code: 'PLUGIN_BRIDGE_PROTOCOL_ERROR',
            stage: 'bridge',
            message: `Unsupported plugin host API: ${request.api}`,
          });
          respond(createPluginBridgeResponse({
            requestId: request.requestId,
            ok: false,
            error: toRuntimeErrorPayload(unsupportedApi),
          }));
          commitDiagnostic(unsupportedApi, 'crashed');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [
    commitDiagnostic,
    getHostObjectById,
    getHostObjects,
    getSelection,
    iframeHeight,
    instance.capabilities,
    instance.instanceId,
    nodeId,
    onPatchInstanceProps,
  ]);

  return {
    iframeRef,
    srcDoc,
    iframeHeight,
    runtimeState,
  };
}
