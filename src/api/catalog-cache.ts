import { app } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ToolDefinition } from '../shared/types'

export class CatalogCache {
  private readonly path = join(app.getPath('userData'), 'catalog.json')

  async read(): Promise<ToolDefinition[]> {
    return JSON.parse(await readFile(this.path, 'utf8')) as ToolDefinition[]
  }

  async write(catalog: ToolDefinition[]): Promise<void> {
    await writeFile(this.path, JSON.stringify(catalog), { mode: 0o600 })
  }
}
