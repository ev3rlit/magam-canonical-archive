import type { RpcAdapterDescriptor, RpcLogicalMethod } from '@/features/host/contracts';

export interface RpcParityReport {
  desktopOnly: RpcLogicalMethod[];
  shared: RpcLogicalMethod[];
  webOnly: RpcLogicalMethod[];
}

export function validateAdapterParity(input: {
  desktop: Pick<RpcAdapterDescriptor, 'methods'>;
  web: Pick<RpcAdapterDescriptor, 'methods'>;
}): RpcParityReport {
  const desktopMethods = new Set(input.desktop.methods);
  const webMethods = new Set(input.web.methods);

  const desktopOnly = [...desktopMethods].filter((method) => !webMethods.has(method));
  const webOnly = [...webMethods].filter((method) => !desktopMethods.has(method));
  const shared = [...desktopMethods].filter((method) => webMethods.has(method));

  if (desktopOnly.length > 0 || webOnly.length > 0) {
    throw new Error(
      `RPC adapter parity mismatch. desktopOnly=${desktopOnly.join(',')} webOnly=${webOnly.join(',')}`,
    );
  }

  return {
    desktopOnly,
    shared,
    webOnly,
  };
}
