import {app} from "electron";
import {copyFile, mkdir, readdir, readFile, writeFile} from "node:fs/promises";
import {join} from "node:path";

export interface UserConfig {
  theme: string
  windowWidth: number
  windowHeight: number
  alwaysOnTop: boolean
  startOnStartup: boolean;
}

const defaults: UserConfig = {
  theme: 'rofi-dark',
  windowWidth: 820,
  windowHeight: 600,
  alwaysOnTop: true,
  startOnStartup: false,
}

function normalizeThemeName(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\.css$/i, "") : defaults.theme;
}

export class UserConfigStore {
  private readonly directory = join(process.env.XDG_CONFIG_HOME ?? join(app.getPath('home'), '.config'), 'd3vtools')
  private readonly path = join(this.directory, 'config.json')

  getThemesDirectory(): string {
    return join(this.directory, "themes");
  }

  async get(): Promise<UserConfig> {
    try {
      const saved = JSON.parse(await readFile(this.path, 'utf8')) as Partial<UserConfig>
      return {...defaults, ...saved, theme: normalizeThemeName(saved.theme)};
    } catch {
      return defaults
    }
  }

  async getTheme(): Promise<string> {
    const config = await this.get()
    const themePath = join(this.getThemesDirectory(), `${config.theme}.css`);
    try { return await readFile(themePath, 'utf8') }
    catch { return '' }
  }

  async getThemes(): Promise<string[]> {
    await this.ensureDirectories();
    const files = await readdir(this.getThemesDirectory(), {withFileTypes: true});
    return files.filter((file) => file.isFile() && file.name.toLowerCase().endsWith(".css")).map((file) => file.name.slice(0, -4)).sort();
  }

  async save(config: UserConfig): Promise<void> {
    await this.ensureDirectories();
    let existing: Record<string, unknown> = {};
    try {
      existing = JSON.parse(await readFile(this.path, "utf8")) as Record<string, unknown>;
    } catch { /* first run */
    }
    await writeFile(this.path, JSON.stringify({...existing, ...config}, null, 2), {mode: 0o600});
  }

  async ensureDirectories(): Promise<void> {
    const themesDirectory = this.getThemesDirectory();
    await mkdir(themesDirectory, {recursive: true});
    const defaultTheme = join(themesDirectory, "rofi-dark.css");
    try {
      await readFile(defaultTheme);
    } catch {
      // Seed the bundled default only when it is absent; never overwrite user changes.
      try {
        await copyFile(join(app.getAppPath(), "themes", "rofi-dark.css"), defaultTheme);
      } catch { /* A missing bundled theme should not prevent startup. */
      }
    }
  }
}
