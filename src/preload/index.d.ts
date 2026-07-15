import type { AppSettings, ApiResult, ToolDefinition, ToolRequest, UserConfig } from '../shared/types'

declare global {
  interface Window { d3vtools: {
    getSettings(): Promise<AppSettings>
    saveSettings(settings: AppSettings): Promise<void>
    getConfig(): Promise<UserConfig>
    getTheme(): Promise<string>
    hideWindow(): Promise<void>
    setApiKey(key: string): Promise<void>
    removeApiKey(): Promise<boolean>
    getCatalog(): Promise<ToolDefinition[]>
    getAppVersion(): Promise<string>
    openWebsite(): Promise<void>
    execute(category: string, tool: string, payload: ToolRequest): Promise<ApiResult>
  } }
}
export {}
