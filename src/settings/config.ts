import { app } from 'electron'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface UserConfig {
  theme: string
  windowWidth: number
  windowHeight: number
  alwaysOnTop: boolean
}

const defaults: UserConfig = {
  theme: 'rofi-dark',
  windowWidth: 760,
  windowHeight: 520,
  alwaysOnTop: true,
}

export class UserConfigStore {
  private readonly directory = join(process.env.XDG_CONFIG_HOME ?? join(app.getPath('home'), '.config'), 'd3vtools')
  private readonly path = join(this.directory, 'config.json')

  async get(): Promise<UserConfig> {
    try {
      const saved = JSON.parse(await readFile(this.path, 'utf8')) as Partial<UserConfig>
      return { ...defaults, ...saved }
    } catch {
      return defaults
    }
  }

  async getTheme(): Promise<string> {
    const config = await this.get()
    const themePath = join(this.directory, 'themes', `${config.theme}.css`)
    try { return await readFile(themePath, 'utf8') }
    catch { return '' }
  }

  async ensureDirectories(): Promise<void> {
    await mkdir(join(this.directory, 'themes'), { recursive: true })
  }
}
