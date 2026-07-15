import { describe, expect, it, vi } from 'vitest'
import { D3vToolsApi } from '../src/api/client'

describe('D3vToolsApi catalog normalization', () => {
  it('maps Laravel snake_case input metadata to the renderer contract', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [{ name: 'Image to Base64', slug: 'image-to-base64', category: 'base64-tools', description: 'Upload an image', type: 'upload', input_type: 'file', tier: 'free' }] }), { status: 200 }))
    const catalog = await new D3vToolsApi('https://d3v.tools', async () => null).getCatalog()
    expect(catalog[0].inputType).toBe('file')
    expect(catalog[0]).not.toHaveProperty('input_type')
    fetchMock.mockRestore()
  })

  it('surfaces a safe API error message', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ message: 'This tool requires a premium subscription.' }), { status: 403 }))
    await expect(new D3vToolsApi('http://127.0.0.1', async () => null).getCatalog()).rejects.toThrow('This tool requires a premium subscription.')
    fetchMock.mockRestore()
  })
})
