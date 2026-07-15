import {contextBridge, ipcRenderer} from "electron";
import type {AppSettings, ToolRequest, UserConfig} from "../shared/types";

contextBridge.exposeInMainWorld('d3vtools', {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: AppSettings): Promise<void> => ipcRenderer.invoke('settings:save', settings),
  setShortcutRecording: (recording: boolean): Promise<void> => ipcRenderer.invoke("shortcut:recording", recording),
  resizeWindow: (width: number, height: number): Promise<void> => ipcRenderer.invoke("window:resize", width, height),
  getConfig: (): Promise<UserConfig> => ipcRenderer.invoke('config:get'),
  saveConfig: (config: UserConfig): Promise<void> => ipcRenderer.invoke("config:save", config),
  getTheme: (): Promise<string> => ipcRenderer.invoke('theme:get'),
  getThemes: (): Promise<string[]> => ipcRenderer.invoke("theme:list"),
  openThemesDirectory: (): Promise<void> => ipcRenderer.invoke("theme:open-directory"),
  hideWindow: (): Promise<void> => ipcRenderer.invoke('window:hide'),
  setApiKey: (key: string): Promise<void> => ipcRenderer.invoke('api-key:set', key),
  removeApiKey: (): Promise<boolean> => ipcRenderer.invoke('api-key:remove'),
  hasApiKey: (): Promise<boolean> => ipcRenderer.invoke("api-key:has"),
  getCatalog: () => ipcRenderer.invoke('catalog:get'),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  openWebsite: (): Promise<void> => ipcRenderer.invoke('app:open-website'),
  openAccount: (destination: "app" | "billing"): Promise<void> => ipcRenderer.invoke("app:open-account", destination),
  execute: (category: string, tool: string, payload: ToolRequest) => ipcRenderer.invoke('tool:execute', category, tool, payload)
})
