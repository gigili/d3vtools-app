/// <reference path="../preload/index.d.ts" />
import { searchCatalog } from '../search/catalog'
import type { ApiResult, RateLimitInfo, ToolDefinition } from '../shared/types'
import { displayValue, inputModeFor, isRecord, outputFileFor, parseStructuredResult, presentationFor, unwrapResult } from './format'
import './style.css'

let catalog: ToolDefinition[] = []
let selected = 0
const search = document.querySelector<HTMLInputElement>('#search')!
const results = document.querySelector<HTMLElement>('#results')!
const status = document.querySelector<HTMLElement>('#status')!
const version = document.querySelector<HTMLElement>('#app-version')!
const quota = document.querySelector<HTMLElement>('#quota')!
const poweredBy = document.querySelector<HTMLButtonElement>('#powered-by')!

function button(label: string, className = ''): HTMLButtonElement {
  const element = document.createElement('button'); element.type = 'button'; element.className = className; element.textContent = label; return element
}

function render(): void {
  const matches = searchCatalog(catalog, search.value)
  selected = Math.min(selected, Math.max(0, matches.length - 1))
  results.replaceChildren(...matches.slice(0, 12).map((tool, index) => {
    const item = button('', `result ${index === selected ? 'selected' : ''}`)
    const name = document.createElement('strong'); name.textContent = tool.name
    const description = document.createElement('small'); description.textContent = tool.description
    const meta = document.createElement('span'); meta.className = 'result-meta'; meta.textContent = `${tool.category} · ${tool.inputType}`
    item.append(name, description, meta); item.onclick = () => openTool(tool); return item
  }))
  status.textContent = catalog.length ? `${matches.length} tools · Enter to open` : 'Catalog unavailable — check your connection or API URL'
}

function openTool(tool: ToolDefinition): void {
  const presentation = presentationFor(tool)
  const inputMode = inputModeFor(tool)
  const shell = document.createElement('article'); shell.className = 'tool-shell'
  const header = document.createElement('header'); header.className = 'tool-header'
  const back = button('←', 'icon-button'); back.title = 'Back to tools'; back.onclick = render
  const heading = document.createElement('div'); heading.className = 'tool-heading'
  const title = document.createElement('h2'); title.textContent = tool.name
  const description = document.createElement('p'); description.textContent = tool.description
  const badge = document.createElement('span'); badge.className = 'badge'; badge.textContent = `${tool.category} · ${inputMode} input · ${presentation} output`
  const endpoint = document.createElement('span'); endpoint.className = 'endpoint'; endpoint.textContent = 'API: loading…'
  heading.append(title, description, badge, endpoint); header.append(back, heading)
  void window.d3vtools.getSettings().then((config) => { try { endpoint.textContent = `API: ${new URL(config.apiBaseUrl).host}` } catch { endpoint.textContent = 'API: invalid URL' } })

  const workspace = document.createElement('div'); workspace.className = 'workspace'
  const inputPane = document.createElement('section'); inputPane.className = 'pane input-pane'
  const inputLabel = document.createElement('label'); inputLabel.className = 'pane-title'; inputLabel.textContent = 'Input'
  const input = document.createElement('textarea'); input.id = 'tool-input'; input.spellcheck = false; input.placeholder = inputPlaceholder(tool)
  inputPane.append(inputLabel)
  if (inputMode === 'file' || inputMode === 'mixed') {
    const fileRow = document.createElement('div'); fileRow.className = 'file-row'
    const file = document.createElement('input'); file.type = 'file'; file.className = 'file-input'; file.accept = '*/*'
    const fileName = document.createElement('span'); fileName.className = 'file-name'; fileName.textContent = 'Choose a file, or paste text below'
    file.onchange = () => {
      const selectedFile = file.files?.[0]
      if (!selectedFile) return
      fileName.textContent = selectedFile.name
      const identity = `${tool.name} ${tool.slug}`.toLowerCase()
      if (/(?:image|jpg|jpeg|png)\s+to\s+base64|(?:image|jpg|jpeg|png)-to-base64/.test(identity)) {
        void selectedFile.arrayBuffer().then((buffer) => { input.value = `data:${selectedFile.type || 'application/octet-stream'};base64,${arrayBufferToBase64(buffer)}` })
      } else void selectedFile.text().then((text) => { input.value = text })
    }
    fileRow.append(file, fileName); inputPane.append(fileRow)
  }
  if (inputMode !== 'file') inputPane.append(input)
  const outputPane = document.createElement('section'); outputPane.className = 'pane output-pane'
  const outputTitle = document.createElement('div'); outputTitle.className = 'pane-title'; outputTitle.textContent = 'Output'
  const output = document.createElement('div'); output.className = 'output empty'; output.textContent = 'Run the tool to see the result.'
  outputPane.append(outputTitle, output); workspace.append(inputPane, outputPane)
  const actions = document.createElement('footer'); actions.className = 'tool-actions'
  const run = button('Run', 'primary-button'); const shortcut = document.createElement('span'); shortcut.className = 'shortcut'; shortcut.textContent = 'Ctrl/Cmd + Enter'
  actions.append(run, shortcut); shell.append(header, workspace, actions); results.replaceChildren(shell); input.focus()

  const execute = async (): Promise<void> => {
    run.disabled = true; run.textContent = 'Running…'; output.className = 'output loading'; output.textContent = 'Running…'
    try {
      const response = await window.d3vtools.execute(tool.category, tool.slug, { input: input.value }) as ApiResult
      renderRateLimit(response.meta?.rate_limit)
      renderOutput(output, parseStructuredResult(unwrapResult(response)), presentation, tool)
    } catch (error) { output.className = 'output error'; output.textContent = error instanceof Error ? error.message : 'Request failed' }
    finally { run.disabled = false; run.textContent = 'Run' }
  }
  run.onclick = () => void execute()
  input.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void execute() })
}

function inputPlaceholder(tool: ToolDefinition): string {
  const identity = `${tool.name} ${tool.slug}`.toLowerCase()
  if (identity.includes('json')) return '{\n  "key": "value"\n}'
  if (identity.includes('base64')) return 'Paste text to encode or a Base64 value to decode…'
  if (identity.includes('url')) return 'Paste a URL or text…'
  if (identity.includes('regex')) return 'Paste the text to test…'
  return tool.inputType === 'code' ? 'Paste code here…' : 'Enter input…'
}

function renderRateLimit(value: unknown): void {
  if (!value || typeof value !== 'object') return
  const rate = value as RateLimitInfo
  if (typeof rate.remaining !== 'number' || typeof rate.limit !== 'number') return
  const reset = typeof rate.resets_in_seconds === 'number' ? ` · resets in ${formatDuration(rate.resets_in_seconds)}` : ''
  quota.textContent = `${rate.remaining}/${rate.limit} requests left${rate.tier ? ` · ${rate.tier}` : ''}${reset}`
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  return `${Math.ceil(seconds / 60)}m`
}

function renderOutput(container: HTMLElement, value: unknown, presentation: string, tool: ToolDefinition): void {
  container.replaceChildren(); container.className = `output ${presentation}`
  const toolbar = document.createElement('div'); toolbar.className = 'output-toolbar'
  const copy = button('Copy', 'secondary-button'); copy.onclick = async () => { await navigator.clipboard.writeText(displayValue(value)); copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy' }, 1200) }
  toolbar.append(copy)
  const file = outputFileFor(tool, value)
  if (file) { const download = button(file.label, 'secondary-button'); download.onclick = () => saveOutput(value, tool, file); toolbar.append(download) }
  if (presentation === 'json') {
    const tree = document.createElement('div'); tree.className = 'tree-wrap'
    const controls = document.createElement('div'); controls.className = 'tree-controls'
    const filter = document.createElement('input'); filter.className = 'tree-search'; filter.placeholder = 'Search keys and values…'; filter.setAttribute('aria-label', 'Search output')
    const expand = button('Expand all', 'text-button'); const collapse = button('Collapse all', 'text-button')
    controls.append(filter, expand, collapse); toolbar.append(controls); container.append(toolbar, tree)
    const draw = (): void => { tree.replaceChildren(renderTree(value, '', filter.value)); expand.onclick = () => tree.querySelectorAll('details').forEach((node) => { node.open = true }); collapse.onclick = () => tree.querySelectorAll('details').forEach((node) => { node.open = false }) }
    filter.oninput = draw; draw()
  } else if (presentation === 'table') {
    const rows = Array.isArray(value) && value.every(isRecord) ? value : parseDelimited(value)
    container.append(toolbar, Array.isArray(rows) && rows.length ? renderTable(rows) : renderPlainPreview(value))
  } else if (presentation === 'download') {
    const image = imageFromDataUri(value)
    if (image) { const preview = document.createElement('img'); preview.className = 'image-preview'; preview.src = image; preview.alt = 'Decoded image output'; container.append(toolbar, preview) }
    else container.append(toolbar, renderPlainPreview(value))
  } else {
    const pre = document.createElement('pre'); pre.textContent = displayValue(value); container.append(toolbar, pre)
  }
}

function saveOutput(value: unknown, tool: ToolDefinition, file: { extension: string; mime: string }): void {
  const dataUri = imageFromDataUri(value)
  const blob = dataUri ? dataUriToBlob(dataUri) : new Blob([displayValue(value)], { type: file.mime })
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${tool.slug}-output.${file.extension}`; link.click(); URL.revokeObjectURL(link.href)
}

function renderPlainPreview(value: unknown): HTMLPreElement { const pre = document.createElement('pre'); pre.textContent = displayValue(value); return pre }

function parseDelimited(value: unknown): Array<Record<string, unknown>> {
  if (typeof value !== 'string') return []
  const delimiter = value.includes('\t') ? '\t' : ','
  const rows = value.trim().split(/\r?\n/).map((line) => line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, '')))
  if (rows.length < 2) return []
  return rows.slice(1).map((row) => Object.fromEntries(rows[0].map((header, index) => [header || `Column ${index + 1}`, row[index] ?? ''])))
}

function imageFromDataUri(value: unknown): string | null { return typeof value === 'string' && /^data:image\/[a-z0-9.+-]+;base64,/i.test(value) ? value : null }

function dataUriToBlob(uri: string): Blob {
  const [header, encoded] = uri.split(',', 2); const mime = header.match(/^data:([^;]+)/i)?.[1] ?? 'application/octet-stream'; const binary = atob(encoded); const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: mime })
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer); let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  return btoa(binary)
}

function renderTree(value: unknown, key: string, query: string): HTMLElement {
  const directMatch = !query || key.toLowerCase().includes(query.toLowerCase()) || (!isRecord(value) && !Array.isArray(value) && displayValue(value).toLowerCase().includes(query.toLowerCase()))
  if (isRecord(value) || Array.isArray(value)) {
    const details = document.createElement('details'); details.open = Boolean(query) || directMatch
    const summary = document.createElement('summary'); summary.setAttribute('role', 'treeitem'); summary.innerHTML = `<span class="tree-key">${escapeHtml(key || 'root')}</span> <span class="tree-count">${Array.isArray(value) ? value.length : Object.keys(value).length} items</span>`
    const children = document.createElement('div'); children.className = 'tree-children'
    const entries = Array.isArray(value) ? value.map((item, index) => [String(index), item] as const) : Object.entries(value)
    const childQuery = directMatch ? '' : query
    entries.forEach(([childKey, childValue]) => { const child = renderTree(childValue, childKey, childQuery); if (child.textContent) children.append(child) })
    if (!query || directMatch || children.childElementCount) { details.append(summary, children); return details }
  }
  if (query && !directMatch) return document.createElement('span')
  const row = document.createElement('div'); row.className = 'tree-row'; const name = document.createElement('span'); name.className = 'tree-key'; name.textContent = key
  const primitive = document.createElement('span'); primitive.className = `tree-value ${value === null ? 'null' : typeof value}`; primitive.textContent = displayValue(value); row.append(name, primitive); return row
}

function renderTable(rows: Array<Record<string, unknown>>): HTMLElement {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  const table = document.createElement('table'); table.className = 'result-table'
  const head = document.createElement('thead'); const heading = document.createElement('tr')
  columns.forEach((column) => { const cell = document.createElement('th'); cell.textContent = column; heading.append(cell) }); head.append(heading)
  const body = document.createElement('tbody')
  rows.forEach((row) => { const line = document.createElement('tr'); columns.forEach((column) => { const cell = document.createElement('td'); cell.textContent = displayValue(row[column]); line.append(cell) }); body.append(line) })
  table.append(head, body); return table
}

function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]!) }
search.addEventListener('input', () => { selected = 0; render() })
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') void window.d3vtools.hideWindow() })
search.addEventListener('keydown', (event) => { const count = searchCatalog(catalog, search.value).length; if (event.key === 'ArrowDown') { selected = Math.min(selected + 1, count - 1); render() } if (event.key === 'ArrowUp') { selected = Math.max(selected - 1, 0); render() } if (event.key === 'Enter') { const tool = searchCatalog(catalog, search.value)[selected]; if (tool) openTool(tool) } })
window.d3vtools.getTheme().then((theme) => { if (theme) { const style = document.createElement('style'); style.dataset.userTheme = 'true'; style.textContent = theme; document.head.append(style) } }).finally(() => { window.d3vtools.getCatalog().then((value) => { catalog = value; render() }).catch(() => render()) })
window.d3vtools.getAppVersion().then((value) => { version.textContent = `v${value}` }).catch(() => { version.textContent = 'v—' })
poweredBy.onclick = () => void window.d3vtools.openWebsite()
