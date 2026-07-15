import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings, ToolRequest, UserConfig } from '../shared/types'

contextBridge.exposeInMainWorld('d3vtools', {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: AppSettings): Promise<void> => ipcRenderer.invoke('settings:save', settings),
  getConfig: (): Promise<UserConfig> => ipcRenderer.invoke('config:get'),
  getTheme: (): Promise<string> => ipcRenderer.invoke('theme:get'),
  hideWindow: (): Promise<void> => ipcRenderer.invoke('window:hide'),
  setApiKey: (key: string): Promise<void> => ipcRenderer.invoke('api-key:set', key),
  removeApiKey: (): Promise<boolean> => ipcRenderer.invoke('api-key:remove'),
  getCatalog: () => ipcRenderer.invoke('catalog:get'),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  openWebsite: (): Promise<void> => ipcRenderer.invoke('app:open-website'),
  execute: (category: string, tool: string, payload: ToolRequest) => ipcRenderer.invoke('tool:execute', category, tool, payload)
})
