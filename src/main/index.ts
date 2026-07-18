import {app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, shell, Tray} from "electron";
import {mkdir, rm, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {D3vToolsApi} from "../api/client";
import {CatalogCache} from "../api/catalog-cache";
import {UserConfigStore} from "../settings/config";
import {SettingsStore} from "../settings/store";
import type {AppSettings, ToolRequest} from "../shared/types";
import {latestReleaseFor} from "../update/check";

let window: BrowserWindow | null = null
let tray: Tray | null = null
const settings = new SettingsStore()
const catalogCache = new CatalogCache()
const userConfig = new UserConfigStore()

async function createWindow(): Promise<void> {
  const config = await userConfig.get()
  await setStartOnStartup(config.startOnStartup);
  window = new BrowserWindow({ width: config.windowWidth, height: config.windowHeight, show: false, frame: false, resizable: true, transparent: true, hasShadow: false, alwaysOnTop: config.alwaysOnTop,
    // i3 treats Linux toolbar windows as floating while keeping them resizable.
    ...(process.platform === 'linux' ? { type: 'toolbar' } : {}),
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false } })
  void window.loadURL(process.env.ELECTRON_RENDERER_URL ?? `file://${join(__dirname, '../renderer/index.html')}`)
}

async function registerShortcut(): Promise<void> {
  const { shortcut } = await settings.get()
  globalShortcut.unregisterAll()
  const registered = globalShortcut.register(shortcut, () => {
    window?.isVisible() ? window.hide() : window?.show();
  });
  if (!registered) throw new Error(`Could not register global shortcut “${shortcut}”. It may already be in use.`);
}

async function setStartOnStartup(enabled: boolean): Promise<void> {
  if (process.platform === "win32" || process.platform === "darwin") app.setLoginItemSettings({openAtLogin: enabled});
  if (process.platform !== "linux" || !app.isPackaged) return;
  const autostartDirectory = join(process.env.XDG_CONFIG_HOME ?? join(app.getPath("home"), ".config"), "autostart");
  const desktopEntry = join(autostartDirectory, "d3vtools.desktop");
  if (!enabled) {
    await rm(desktopEntry, {force: true});
    return;
  }
  await mkdir(autostartDirectory, {recursive: true});
  await writeFile(desktopEntry, `[Desktop Entry]\nType=Application\nName=D3vTools\nComment=Launch D3vTools in the system tray\nExec="${process.execPath}" --hidden\nTerminal=false\nX-GNOME-Autostart-enabled=true\n`, {mode: 0o600});
}

function trayImage(): Electron.NativeImage {
  const iconPath = app.isPackaged
      ? join(process.resourcesPath, "icons", "d3vtools-tray.png")
      : join(app.getAppPath(), "build", "d3vtools-tray.png");
  const image = nativeImage.createFromPath(iconPath);
  return image.isEmpty() ? nativeImage.createEmpty() : image;
}

app.whenReady().then(async () => {
  await userConfig.ensureDirectories()
  await createWindow()
  tray = new Tray(trayImage());
  tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Open D3vTools', click: () => window?.show() }, { label: 'Quit', click: () => app.quit() }]))
  ipcMain.handle('settings:get', () => settings.get())
  ipcMain.handle("shortcut:recording", async (_event, recording: boolean) => {
    if (recording) globalShortcut.unregisterAll();
    else await registerShortcut();
  });
  ipcMain.handle("settings:save", async (_event, value: AppSettings) => {
    const previous = await settings.get();
    await settings.save(value);
    try {
      await registerShortcut();
    } catch (error) {
      await settings.save(previous);
      await registerShortcut();
      throw error;
    }
  });
  ipcMain.handle('config:get', () => userConfig.get())
  ipcMain.handle("config:save", async (_event, value) => {
    await userConfig.save(value);
    await setStartOnStartup(value.startOnStartup);
    window?.setAlwaysOnTop(value.alwaysOnTop);
    window?.setSize(value.windowWidth, value.windowHeight);
  });
  ipcMain.handle('theme:get', () => userConfig.getTheme())
  ipcMain.handle("theme:list", () => userConfig.getThemes());
  ipcMain.handle("theme:open-directory", async () => {
    const error = await shell.openPath(userConfig.getThemesDirectory());
    if (error) throw new Error(error);
  });
  ipcMain.handle('app:version', () => app.getVersion())
	ipcMain.handle("update:check", async () => {
		try {
			const response = await fetch("https://api.github.com/repos/gigili/d3vtools-app/releases/latest", {
				headers: {
					Accept: "application/vnd.github+json",
					"User-Agent": "D3vTools-Desktop"
				}
			});
			if (!response.ok) return null;
			return latestReleaseFor(app.getVersion(), await response.json() as {
				tag_name?: string;
				draft?: boolean;
				prerelease?: boolean
			});
		} catch {
			return null;
		}
	});
	ipcMain.handle("update:open", () => shell.openExternal("https://github.com/gigili/d3vtools-app/releases/latest"));
  ipcMain.handle('app:open-website', () => shell.openExternal('https://d3v.tools'))
  ipcMain.handle("app:open-account", (_event, destination: "app" | "billing") => shell.openExternal(destination === "billing" ? "https://d3v.tools/app/billing" : "https://d3v.tools/app"));
  ipcMain.handle('window:hide', () => window?.hide())
  ipcMain.handle("window:resize", (_event, width: number, height: number) => {
    if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error("Window dimensions must be numbers.");
    window?.setSize(Math.round(Math.max(320, Math.min(4000, width))), Math.round(Math.max(240, Math.min(4000, height))));
  });
  ipcMain.handle('api-key:set', (_event, value: string) => settings.setApiKey(value))
  ipcMain.handle('api-key:remove', () => settings.deleteApiKey())
  ipcMain.handle("api-key:has", async () => Boolean(await settings.getApiKey()));
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
