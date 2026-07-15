import { describe, expect, it } from 'vitest'
import { searchCatalog } from '../src/search/catalog'

const tools = [
  { category: 'JSON', name: 'JSON Format', slug: 'json-format', description: 'Format JSON', type: 'server', tier: 'free', inputType: 'code', keywords: ['pretty'] },
  { category: 'Encoding', name: 'Base64 Encode', slug: 'base64-encode', description: 'Encode text', type: 'server', tier: 'free', inputType: 'textarea' }
] as const

describe('searchCatalog', () => {
  it('ranks exact names above partial matches', () => expect(searchCatalog([...tools], 'JSON Format')[0].slug).toBe('json-format'))
  it('searches keywords', () => expect(searchCatalog([...tools], 'pretty')).toHaveLength(1))
  it('ranks the exact multi-word tool and ignores category-only matches', () => {
    const matches = searchCatalog([
      ...tools,
      { category: 'encode-decode', name: 'URL Encode', slug: 'url-encode', description: 'Encode text', type: 'server', tier: 'free', inputType: 'textarea' },
      { category: 'encode-decode', name: 'JSON Decode', slug: 'json-decode', description: 'Decode JSON', type: 'server', tier: 'free', inputType: 'textarea' },
    ], 'json decode')
    expect(matches.map((tool) => tool.slug)).toEqual(['json-decode'])
  })
})
