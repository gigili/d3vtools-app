export type ToolType = 'client' | 'upload' | 'server'
export type ResultType = 'plain' | 'code' | 'json' | 'table' | 'download'

export interface ToolDefinition {
  category: string
  name: string
  slug: string
  description: string
  type?: ToolType
  tier: 'free' | 'premium'
  inputType?: 'textarea' | 'file' | 'code' | 'mixed'
  keywords?: readonly string[]
  desktopSupported?: boolean
  resultType?: ResultType
  webFallbackUrl?: string
}

export interface ToolRequest {
  input?: string
  options?: Record<string, unknown>
  from?: string
  to?: string
  value?: string
}

export interface ApiResult {
  success: boolean
  result?: unknown
  data?: unknown
  message?: string
  errors?: Record<string, string[]>
  meta?: Record<string, unknown>
}

export interface RateLimitInfo {
  tier?: string
  limit?: number
  remaining?: number
  resets_in_seconds?: number
}

export interface AppSettings {
  apiBaseUrl: string
  shortcut: string
}

export interface UserConfig {
  theme: string
  windowWidth: number
  windowHeight: number
  alwaysOnTop: boolean
}
