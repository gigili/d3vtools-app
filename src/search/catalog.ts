import type { ToolDefinition } from '../shared/types'

export function searchCatalog(tools: ToolDefinition[], query: string): ToolDefinition[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return tools

  return tools
    .map((tool, index) => ({ tool, index, score: scoreTool(tool, terms) }))
    .filter((item) => item.score > 0 && terms.every((term) => searchableText(item.tool).includes(term) || item.tool.category.toLowerCase() === term))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.tool)
}

function scoreTool(tool: ToolDefinition, terms: string[]): number {
  const name = tool.name.toLowerCase()
  const slug = tool.slug.toLowerCase()
  const category = tool.category.toLowerCase()
  const phrase = terms.join(' ')
  const phraseMatch = name.includes(phrase) || slug.includes(phrase.replaceAll(' ', '-')) ? 100 : 0
  return phraseMatch + terms.reduce((score, term) => {
    if (slug === term || name === term) return score + 100
    if (slug.startsWith(term) || name.startsWith(term)) return score + 60
    if (category === term) return score + 35
    return score + (searchableText(tool).includes(term) ? 10 : 0)
  }, 0)
}

function searchableText(tool: ToolDefinition): string {
  return `${tool.name} ${tool.slug} ${tool.description} ${(tool.keywords ?? []).join(' ')}`.toLowerCase()
}
