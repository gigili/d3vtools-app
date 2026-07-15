import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, shell, Tray } from 'electron'
import { join } from 'node:path'
import { D3vToolsApi } from '../api/client'
import { CatalogCache } from '../api/catalog-cache'
import { UserConfigStore } from '../settings/config'
import { SettingsStore } from '../settings/store'
import type { AppSettings, ToolRequest } from '../shared/types'

let window: BrowserWindow | null = null
let tray: Tray | null = null
const settings = new SettingsStore()
const catalogCache = new CatalogCache()
const userConfig = new UserConfigStore()

async function createWindow(): Promise<void> {
  const config = await userConfig.get()
  window = new BrowserWindow({ width: config.windowWidth, height: config.windowHeight, show: false, frame: false, resizable: true, transparent: true, hasShadow: false, alwaysOnTop: config.alwaysOnTop,
    // i3 treats Linux toolbar windows as floating while keeping them resizable.
    ...(process.platform === 'linux' ? { type: 'toolbar' } : {}),
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false } })
  void window.loadURL(process.env.ELECTRON_RENDERER_URL ?? `file://${join(__dirname, '../renderer/index.html')}`)
}

async function registerShortcut(): Promise<void> {
  const { shortcut } = await settings.get()
  globalShortcut.unregisterAll()
  globalShortcut.register(shortcut, () => { window?.isVisible() ? window.hide() : window?.show() })
}

app.whenReady().then(async () => {
  await userConfig.ensureDirectories()
  await createWindow()
  tray = new Tray(nativeImage.createEmpty())
  tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Open D3vTools', click: () => window?.show() }, { label: 'Quit', click: () => app.quit() }]))
  ipcMain.handle('settings:get', () => settings.get())
  ipcMain.handle('settings:save', (_event, value: AppSettings) => settings.save(value))
  ipcMain.handle('config:get', () => userConfig.get())
  ipcMain.handle('theme:get', () => userConfig.getTheme())
  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('app:open-website', () => shell.openExternal('https://d3v.tools'))
  ipcMain.handle('window:hide', () => window?.hide())
  ipcMain.handle('api-key:set', (_event, value: string) => settings.setApiKey(value))
  ipcMain.handle('api-key:remove', () => settings.deleteApiKey())
  ipcMain.handle('catalog:get', async () => {
    const config = await settings.get()
    try {
      const catalog = await new D3vToolsApi(config.apiBaseUrl, () => settings.getApiKey()).getCatalog()
      await catalogCache.write(catalog)
      return catalog
    } catch (error) {
      try { return await catalogCache.read() }
      catch { throw error }
    }
  })
  ipcMain.handle('tool:execute', async (_event, category: string, tool: string, payload: ToolRequest) => {
    const config = await settings.get()
    return new D3vToolsApi(config.apiBaseUrl, () => settings.getApiKey()).execute(category, tool, payload)
  })
  await registerShortcut()
})

app.on('will-quit', () => globalShortcut.unregisterAll())
