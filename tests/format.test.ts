import { describe, expect, it } from 'vitest'
import { inputModeFor, outputFileFor, parseStructuredResult, presentationFor, unwrapResult } from '../src/renderer/format'

describe('tool result formatting', () => {
  it('unwraps the API data execution envelope', () => {
    expect(unwrapResult({ success: true, data: [{ input: 'x', result: '{"ok":true}' }] })).toEqual('{"ok":true}')
    expect(unwrapResult({ success: true, data: { input: 'x', result: '{"ok":true}' } })).toEqual('{"ok":true}')
  })

  it('parses JSON returned as a string', () => {
    expect(parseStructuredResult('{"items":[1,2]}')).toEqual({ items: [1, 2] })
    expect(parseStructuredResult('plain text')).toBe('plain text')
  })

  it('chooses useful renderers for common tools', () => {
    const base = { category: 'Encoding', description: '', type: 'server' as const, tier: 'free' as const, inputType: 'textarea' as const }
    expect(presentationFor({ ...base, name: 'JSON Decode', slug: 'json-decode' })).toBe('json')
    expect(presentationFor({ ...base, name: 'Base64 Decode', slug: 'base64-decode' })).toBe('text')
    expect(presentationFor({ ...base, name: 'Color Convert', slug: 'color-convert' })).toBe('table')
  })

  it('infers file input for image-to-Base64 tools without desktop metadata', () => {
    const tool = { category: 'base64-tools', name: 'JPG to Base64', slug: 'jpg-to-base64', description: 'Convert a JPEG image file to Base64.', type: 'server' as const, tier: 'free' as const }
    expect(inputModeFor(tool)).toBe('file')
    expect(presentationFor(tool)).toBe('text')
    expect(presentationFor({ ...tool, name: 'Base64 to Image', slug: 'base64-to-image' })).toBe('download')
    expect(outputFileFor({ ...tool, name: 'Base64 to Image', slug: 'base64-to-image' }, 'data:image/jpeg;base64,abc')?.extension).toBe('jpg')
    expect(outputFileFor({ ...tool, name: 'JSON to Excel', slug: 'json-to-excel' })?.extension).toBe('csv')
  })
})
