import { app } from 'electron'
import { join } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import type { AppSettings } from '../shared/types'

// keytar is a native CommonJS module. Requiring it at runtime avoids Vite's
// ESM namespace wrapper around the native exports in the Electron main bundle.
const keytar = require('keytar') as typeof import('keytar')

const service = 'd3vtools-desktop'
const account = 'api-key'
const defaults: AppSettings = { apiBaseUrl: 'https://d3v.tools', shortcut: 'CommandOrControl+Shift+Space' }

function environmentApiBaseUrl(): string | undefined {
  const value = process.env.D3VTOOLS_API_BASE_URL?.trim()
  return value || undefined
}

export class SettingsStore {
  private readonly path = join(app.getPath('userData'), 'settings.json')

  async get(): Promise<AppSettings> {
    try {
      const saved = JSON.parse(await readFile(this.path, 'utf8')) as Partial<AppSettings>
      const apiBaseUrl = environmentApiBaseUrl()
      return { ...defaults, ...saved, ...(apiBaseUrl ? { apiBaseUrl } : {}) }
    } catch {
      const apiBaseUrl = environmentApiBaseUrl()
      return { ...defaults, ...(apiBaseUrl ? { apiBaseUrl } : {}) }
    }
  }

  async save(settings: AppSettings): Promise<void> {
    await writeFile(this.path, JSON.stringify(settings, null, 2), { mode: 0o600 })
  }

  getApiKey(): Promise<string | null> { return keytar.getPassword(service, account) }
  setApiKey(value: string): Promise<void> { return keytar.setPassword(service, account, value.trim()) }
  deleteApiKey(): Promise<boolean> { return keytar.deletePassword(service, account) }
}
