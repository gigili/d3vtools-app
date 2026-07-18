import type { AppSettings, ApiResult, ToolDefinition, ToolRequest, UpdateInfo, UserConfig } from '../shared/types'

declare global {
  interface Window { d3vtools: {
    getSettings(): Promise<AppSettings>
    saveSettings(settings: AppSettings): Promise<void>
    setShortcutRecording(recording: boolean): Promise<void>
    resizeWindow(width: number, height: number): Promise<void>
    getConfig(): Promise<UserConfig>
    saveConfig(config: UserConfig): Promise<void>
    getTheme(): Promise<string>
    getThemes(): Promise<string[]>
    openThemesDirectory(): Promise<void>
    hideWindow(): Promise<void>
    setApiKey(key: string): Promise<void>
    removeApiKey(): Promise<boolean>
    hasApiKey(): Promise<boolean>
    getCatalog(): Promise<ToolDefinition[]>
    getAppVersion(): Promise<string>
    checkForUpdate(): Promise<UpdateInfo | null>
    openLatestRelease(): Promise<void>
    openWebsite(): Promise<void>
    openAccount(destination: 'app' | 'billing'): Promise<void>
    execute(category: string, tool: string, payload: ToolRequest): Promise<ApiResult>
  } }
}
export {}
