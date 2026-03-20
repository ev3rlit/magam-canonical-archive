import { contextBridge, ipcRenderer } from 'electron';
import {
  MAGAM_DESKTOP_BRIDGE_KEY,
  MAGAM_DESKTOP_IPC_CHANNELS,
  type MagamDesktopBridge,
} from '../app/lib/desktop/bridge-contract';

const bridge: MagamDesktopBridge = {
  pickDirectory: (input) => ipcRenderer.invoke(MAGAM_DESKTOP_IPC_CHANNELS.pickDirectory, input),
  revealPath: (input) => ipcRenderer.invoke(MAGAM_DESKTOP_IPC_CHANNELS.revealPath, input),
  openPath: (input) => ipcRenderer.invoke(MAGAM_DESKTOP_IPC_CHANNELS.openPath, input),
  copyText: (input) => ipcRenderer.invoke(MAGAM_DESKTOP_IPC_CHANNELS.copyText, input),
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld(MAGAM_DESKTOP_BRIDGE_KEY, bridge);
} else {
  (globalThis as typeof globalThis & Record<string, unknown>)[MAGAM_DESKTOP_BRIDGE_KEY] = bridge;
}
