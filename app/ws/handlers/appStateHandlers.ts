import type { RpcMethodRegistry } from '../shared/params';

// App-state WS RPC methods are not part of the current RuntimeWS surface yet.
// The file exists to make the target ownership explicit while routes migrate away
// from the legacy `methods.ts` hub.
export const appStateHandlers: RpcMethodRegistry = {};
