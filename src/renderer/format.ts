import type { ApiResult, ToolDefinition } from '../shared/types'

export type ToolPresentation = 'json' | 'text' | 'code' | 'table' | 'download'
export type ToolInputMode = 'textarea' | 'file' | 'mixed'
export interface OutputFile { extension: string; mime: string; label: string }

export function unwrapResult(response: ApiResult): unknown {
  let value: unknown = response.result !== undefined ? response.result : response.data !== undefined ? response.data : response
  if (Array.isArray(value) && value.length === 1 && isRecord(value[0]) && 'result' in value[0]) value = value[0].result
  if (isRecord(value) && 'result' in value) value = value.result
  return value
}

export function parseStructuredResult(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed || !['{', '['].includes(trimmed[0])) return value
  try { return JSON.parse(trimmed) as unknown } catch { return value }
}

export function presentationFor(tool: ToolDefinition): ToolPresentation {
  if (tool.resultType === 'json' || tool.resultType === 'table') return tool.resultType
  if (tool.resultType === 'code') return 'code'
  if (tool.resultType === 'download') return 'download'
  const identity = `${tool.category} ${tool.name} ${tool.slug} ${(tool.keywords ?? []).join(' ')}`.toLowerCase()
  if (/(?:to|as|→)[ _-]?image\b/.test(identity)) return 'download'
  const jsonOutput = /(?:to|as|→)[ _-]?json\b/.test(identity) || /json-(?:decode|format|validate|path|diff)\b/.test(identity)
  if (jsonOutput) return 'json'
  if (/csv-viewer|(?:to|as|→)[ _-]?(?:csv|tsv)\b/.test(identity)) return 'table'
  if (/json-(?:encode|url-encode|minify)\b|(?:to|as|→)[ _-]?(?:xml|yaml|html|java|text|excel)\b/.test(identity)) return 'code'
  if (/curl|sql|html|css|javascript|typescript|yaml|xml|\bcode\b/.test(identity) && !/base64/.test(identity)) return 'code'
  if (/convert|color|unit|regex|table|csv/.test(identity)) return 'table'
  return 'text'
}

export function inputModeFor(tool: ToolDefinition): ToolInputMode {
  if (tool.inputType === 'file' || tool.inputType === 'mixed' || tool.inputType === 'textarea') return tool.inputType
  const identity = `${tool.name} ${tool.slug} ${tool.description} ${(tool.keywords ?? []).join(' ')}`.toLowerCase()
  if (/(?:image|jpg|jpeg|png)\s+to\s+base64|(?:image|jpg|jpeg|png)-to-base64|^csv\b|csv-to-|file/.test(identity)) return 'file'
  return 'textarea'
}

export function outputFileFor(tool: ToolDefinition, value?: unknown): OutputFile | null {
  const identity = `${tool.name} ${tool.slug}`.toLowerCase()
  if (identity.includes('base64-to-image')) {
    const match = typeof value === 'string' ? value.match(/^data:image\/([a-z0-9.+-]+);base64,/i) : null
    const extension = match?.[1] === 'jpeg' ? 'jpg' : match?.[1] ?? 'png'
    return { extension, mime: `image/${extension === 'jpg' ? 'jpeg' : extension}`, label: 'Download image' }
  }
  const formats: Array<[RegExp, string, string, string]> = [
    [/(?:to|as|→)[ _-]?excel\b/, 'csv', 'text/csv;charset=utf-8', 'Download Excel CSV'],
    [/(?:to|as|→)[ _-]?csv\b/, 'csv', 'text/csv;charset=utf-8', 'Download CSV'],
    [/(?:to|as|→)[ _-]?tsv\b/, 'tsv', 'text/tab-separated-values;charset=utf-8', 'Download TSV'],
    [/(?:to|as|→)[ _-]?xml\b/, 'xml', 'application/xml;charset=utf-8', 'Download XML'],
    [/(?:to|as|→)[ _-]?yaml\b/, 'yaml', 'text/yaml;charset=utf-8', 'Download YAML'],
    [/(?:to|as|→)[ _-]?html\b/, 'html', 'text/html;charset=utf-8', 'Download HTML'],
    [/(?:to|as|→)[ _-]?sql\b/, 'sql', 'application/sql;charset=utf-8', 'Download SQL'],
  ]
  const match = formats.find(([pattern]) => pattern.test(identity))
  return match ? { extension: match[1], mime: match[2], label: match[3] } : null
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function displayValue(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value, null, 2)
}
