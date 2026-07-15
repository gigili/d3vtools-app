import type { ApiResult, ToolDefinition, ToolRequest } from '../shared/types'

export class D3vToolsApi {
  constructor(
    private readonly baseUrl: string,
    private readonly getApiKey: () => Promise<string | null>
  ) {}

  async getCatalog(signal?: AbortSignal): Promise<ToolDefinition[]> {
    const response = await this.request('/api/v1/tools', { signal })
    const body = await response.json() as { data?: Array<ToolDefinition & { input_type?: ToolDefinition['inputType'] }> }
    return (body.data ?? []).map(({ input_type, ...tool }) => ({ ...tool, inputType: tool.inputType ?? input_type }))
  }

  async execute(category: string, tool: string, payload: ToolRequest): Promise<ApiResult> {
    const response = await this.request(`/api/v1/tools/${encodeURIComponent(category)}/${encodeURIComponent(tool)}`, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' }
    })
    return await response.json() as ApiResult
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const apiKey = await this.getApiKey()
    const headers = new Headers(init.headers)
    if (apiKey) headers.set('Authorization', `Bearer ${apiKey}`)
    const url = new URL(path, this.baseUrl)
    const response = await fetch(url, { ...init, headers })
    if (!response.ok) {
      let message = `D3vTools API request failed (${response.status}) at ${url.origin}`
      try {
        const body = await response.clone().json() as { message?: string }
        if (body.message) message = body.message
      } catch { /* Keep the status-based message for non-JSON responses. */ }
      throw new Error(message)
    }
    return response
  }
}
