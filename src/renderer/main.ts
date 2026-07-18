/// <reference path="../preload/index.d.ts" />
import {searchCatalog} from "../search/catalog";
import type {
	ApiResult,
	AppSettings,
	DesktopToolOption,
	RateLimitInfo,
	ToolDefinition,
	ToolFile,
	UserConfig
} from "../shared/types";
import {
	displayValue,
	inputModeFor,
	isRecord,
	outputFileFor,
	parseStructuredResult,
	presentationFor,
	unwrapResult
} from "./format";
import {acceleratorForKeyEvent} from "./shortcut";
import "./style.css";

let catalog: ToolDefinition[] = []
let selected = 0
let windowResizeRequest = 0;
const quotaCacheKey = "d3vtools:last-rate-limit";
const quotaDefaultText = "Requests: run a tool to check quota";
let cachedQuota: (RateLimitInfo & { observedAt: number }) | null = null;
let quotaTimer: number | undefined;
const search = document.querySelector<HTMLInputElement>('#search')!
const results = document.querySelector<HTMLElement>('#results')!
const status = document.querySelector<HTMLElement>('#status')!
const version = document.querySelector<HTMLElement>('#app-version')!
const quota = document.querySelector<HTMLElement>('#quota')!
const poweredBy = document.querySelector<HTMLButtonElement>('#powered-by')!
const updateIndicator = document.querySelector<HTMLButtonElement>("#update-indicator")!;
const settingsButton = document.querySelector<HTMLButtonElement>("#settings-button")!;
const settingsModal = document.querySelector<HTMLElement>("#settings-modal")!;
const settingsForm = document.querySelector<HTMLFormElement>("#settings-form")!;
const settingsClose = document.querySelector<HTMLButtonElement>("#settings-close")!;
const settingsCancel = document.querySelector<HTMLButtonElement>("#settings-cancel")!;
const settingsError = document.querySelector<HTMLElement>("#settings-error")!;
const settingsApiKey = document.querySelector<HTMLInputElement>("#settings-api-key")!;
const settingsApiKeyStatus = document.querySelector<HTMLElement>("#settings-api-key-status")!;
const settingsRemoveKey = document.querySelector<HTMLButtonElement>("#settings-remove-key")!;
const settingsShortcut = document.querySelector<HTMLInputElement>("#settings-shortcut")!;
const settingsOpenThemes = document.querySelector<HTMLButtonElement>("#settings-open-themes")!;

function button(label: string, className = ''): HTMLButtonElement {
  const element = document.createElement('button'); element.type = 'button'; element.className = className; element.textContent = label; return element
}

async function resizeForTool(): Promise<void> {
  const request = ++windowResizeRequest;
  const config = await window.d3vtools.getConfig();
  if (request === windowResizeRequest) await window.d3vtools.resizeWindow(Math.max(config.windowWidth, 1000), Math.max(config.windowHeight, 680));
}

async function restoreConfiguredWindowSize(): Promise<void> {
  const request = ++windowResizeRequest;
  const config = await window.d3vtools.getConfig();
  if (request === windowResizeRequest) await window.d3vtools.resizeWindow(config.windowWidth, config.windowHeight);
}

function render(): void {
  const matches = searchCatalog(catalog, search.value)
  const visibleMatches = matches.slice(0, 12);
  selected = Math.min(selected, Math.max(0, visibleMatches.length - 1));
  const items = visibleMatches.map((tool, index) => {
    const item = button('', `result ${index === selected ? 'selected' : ''}`)
    const name = document.createElement('strong'); name.textContent = tool.name
    const description = document.createElement('small'); description.textContent = tool.description
    const meta = document.createElement('span'); meta.className = 'result-meta'; meta.textContent = `${tool.category} · ${tool.inputType}`
    item.append(name, description, meta);
    item.onclick = () => openTool(tool);
    return item;
  })
  results.replaceChildren(...items);
  items[selected]?.scrollIntoView({block: "nearest"});
  status.textContent = catalog.length ? `${matches.length} tools · Enter to open` : 'Catalog unavailable — check your connection or API URL'
}

function leaveTool(): void {
  render();
  void restoreConfiguredWindowSize();
  search.focus();
}

async function openSettings(): Promise<void> {
  const [appSettings, userConfig, hasApiKey, themes] = await Promise.all([window.d3vtools.getSettings(), window.d3vtools.getConfig(), window.d3vtools.hasApiKey(), window.d3vtools.getThemes()]);
  setSettingsField("settings-api-url", appSettings.apiBaseUrl);
  setSettingsField("settings-shortcut", appSettings.shortcut);
  settingsShortcut.classList.remove("recording", "recorded");
  const themeSelect = document.querySelector<HTMLSelectElement>("#settings-theme")!;
  themeSelect.replaceChildren(...themes.map((theme) => new Option(theme, theme)));
  if (!themes.includes(userConfig.theme)) themeSelect.append(new Option(`${userConfig.theme} (file missing)`, userConfig.theme));
  themeSelect.value = userConfig.theme;
  setSettingsField("settings-width", String(userConfig.windowWidth));
  setSettingsField("settings-height", String(userConfig.windowHeight));
  document.querySelector<HTMLInputElement>("#settings-always-on-top")!.checked = userConfig.alwaysOnTop;
  document.querySelector<HTMLInputElement>("#settings-start-on-startup")!.checked = userConfig.startOnStartup;
  settingsApiKey.value = "";
  settingsApiKeyStatus.textContent = hasApiKey ? "A key is securely stored in the system credential store." : "No API key configured; anonymous limits apply.";
  settingsRemoveKey.disabled = !hasApiKey;
  settingsError.textContent = "";
  settingsModal.hidden = false;
  await window.d3vtools.setShortcutRecording(true);
  document.querySelector<HTMLInputElement>("#settings-api-url")!.focus();
}

function closeSettings(): void {
  settingsModal.hidden = true;
  search.focus();
  void window.d3vtools.setShortcutRecording(false);
}

function setSettingsField(id: string, value: string): void {
  document.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!.value = value;
}

settingsShortcut.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    settingsShortcut.blur();
    return;
  }
  if (event.key === "Backspace" || event.key === "Delete") {
    event.preventDefault();
    settingsShortcut.value = "";
    return;
  }
  const accelerator = acceleratorForKeyEvent(event);
  if (!accelerator) {
    event.preventDefault();
    return;
  }
  event.preventDefault();
  settingsShortcut.value = accelerator;
  settingsShortcut.classList.add("recorded");
});
settingsShortcut.addEventListener("focus", () => {
  settingsShortcut.classList.add("recording");
  settingsShortcut.placeholder = "Press keys now…";
});
settingsShortcut.addEventListener("blur", () => {
  settingsShortcut.classList.remove("recording");
  settingsShortcut.placeholder = "Press a key combination…";
});

settingsButton.onclick = () => {
  void openSettings();
};
settingsOpenThemes.onclick = () => {
  void window.d3vtools.openThemesDirectory().catch((error) => {
    settingsError.textContent = error instanceof Error ? error.message : "Could not open themes directory.";
  });
};
settingsClose.onclick = closeSettings;
settingsCancel.onclick = closeSettings;
settingsModal.onclick = (event) => {
  if (event.target === settingsModal) closeSettings();
};
settingsRemoveKey.onclick = async () => {
  await window.d3vtools.removeApiKey();
	clearQuotaCache();
  settingsApiKey.value = "";
  settingsApiKeyStatus.textContent = "No API key configured; anonymous limits apply.";
  settingsRemoveKey.disabled = true;
};
settingsForm.onsubmit = async (event) => {
  event.preventDefault();
  settingsError.textContent = "";
  const apiBaseUrl = document.querySelector<HTMLInputElement>("#settings-api-url")!.value.trim();
  try {
    const parsed = new URL(apiBaseUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("API base URL must use http or https.");
  } catch {
    settingsError.textContent = "Enter a valid http:// or https:// API base URL.";
    return;
  }
  const shortcut = settingsShortcut.value.trim();
  if (!shortcut) {
    settingsError.textContent = "Press a key combination for the global shortcut.";
    settingsShortcut.focus();
    return;
  }
  const appSettings: AppSettings = {apiBaseUrl, shortcut};
  const userConfig: UserConfig = {
    theme: document.querySelector<HTMLInputElement>("#settings-theme")!.value.trim(),
    windowWidth: Number(document.querySelector<HTMLInputElement>("#settings-width")!.value),
    windowHeight: Number(document.querySelector<HTMLInputElement>("#settings-height")!.value),
    alwaysOnTop: document.querySelector<HTMLInputElement>("#settings-always-on-top")!.checked,
    startOnStartup: document.querySelector<HTMLInputElement>("#settings-start-on-startup")!.checked,
  };
  const submit = settingsForm.querySelector<HTMLButtonElement>("button[type=\"submit\"]")!;
  submit.disabled = true;
  try {
    await window.d3vtools.saveSettings(appSettings);
    if (settingsApiKey.value.trim()) await window.d3vtools.setApiKey(settingsApiKey.value.trim());
    await window.d3vtools.saveConfig(userConfig);
    closeSettings();
    await applyTheme();
    catalog = await window.d3vtools.getCatalog();
    render();
  } catch (error) {
    settingsError.textContent = error instanceof Error ? error.message : "Could not save settings.";
  } finally {
    submit.disabled = false;
  }
};

async function applyTheme(): Promise<void> {
  const theme = await window.d3vtools.getTheme();
  if (!theme) return;
  let style = document.head.querySelector<HTMLStyleElement>("style[data-user-theme]");
  if (!style) {
    style = document.createElement("style");
    style.dataset.userTheme = "true";
    document.head.append(style);
  }
  style.textContent = theme;
}

function openTool(tool: ToolDefinition): void {
  const presentation = presentationFor(tool)
  const inputMode = inputModeFor(tool)
  const shell = document.createElement('article'); shell.className = 'tool-shell'
  const header = document.createElement('header'); header.className = 'tool-header'
  const back = button("←", "icon-button");
  back.title = "Back to tools";
  back.onclick = leaveTool;
  const heading = document.createElement('div'); heading.className = 'tool-heading'
  const title = document.createElement('h2'); title.textContent = tool.name
  const description = document.createElement('p'); description.textContent = tool.description
  const badge = document.createElement('span'); badge.className = 'badge'; badge.textContent = `${tool.category} · ${inputMode} input · ${presentation} output`
  heading.append(title, description, badge);
  header.append(back, heading);

  const workspace = document.createElement('div'); workspace.className = 'workspace'
  const inputPane = document.createElement('section'); inputPane.className = 'pane input-pane'
  const inputLabel = document.createElement('label'); inputLabel.className = 'pane-title'; inputLabel.textContent = 'Input'
  const input = document.createElement("textarea");
  input.id = "tool-input";
  input.spellcheck = false;
  input.value = "";
  input.placeholder = inputPlaceholder(tool).trimStart();
  inputPane.append(inputLabel)
	let selectedFiles: ToolFile[] = [];
  if (inputMode === 'file' || inputMode === 'mixed') {
    const fileRow = document.createElement('div'); fileRow.className = 'file-row'
	  const file = document.createElement("input");
	  file.type = "file";
	  file.className = "file-input";
	  file.accept = tool.desktopUi?.input?.accept ?? "*/*";
	  file.multiple = tool.desktopUi?.input?.multiple ?? false;
    const fileName = document.createElement('span'); fileName.className = 'file-name'; fileName.textContent = 'Choose a file, or paste text below'
	  file.onchange = async () => {
		  const files = [...(file.files ?? [])];
		  if (!files.length) return;
		  fileName.textContent = files.map((selectedFile) => selectedFile.name).join(", ");
      const identity = `${tool.name} ${tool.slug}`.toLowerCase()
		  if (tool.slug === "image-convert") {
			  selectedFiles = await Promise.all(files.map(async (selectedFile) => ({
				  name: selectedFile.name,
				  type: selectedFile.type,
				  data: await selectedFile.arrayBuffer()
			  })));
			  return;
		  }
		  const selectedFile = files[0];
      if (/(?:image|jpg|jpeg|png)\s+to\s+base64|(?:image|jpg|jpeg|png)-to-base64/.test(identity)) {
		  const buffer = await selectedFile.arrayBuffer();
	      input.value = `data:${selectedFile.type || "application/octet-stream"};base64,${arrayBufferToBase64(buffer)}`;
	  } else input.value = await selectedFile.text();
    }
    fileRow.append(file, fileName); inputPane.append(fileRow)
  }
	const optionControls = new Map<string, { element: HTMLInputElement | HTMLSelectElement; value: () => unknown }>();
	if (tool.desktopUi?.options) {
		Object.entries(tool.desktopUi.options).forEach(([key, definition]) => {
			if (isRecord(definition) && "type" in definition) {
				const control = optionControl(key, definition as unknown as DesktopToolOption);
				optionControls.set(key, control);
				inputPane.append(control.container);
			} else if (key === "gif" && isRecord(definition)) {
				Object.entries(definition).forEach(([nestedKey, nestedDefinition]) => {
					if (!isRecord(nestedDefinition) || !("type" in nestedDefinition)) return;
					const control = optionControl(`gif.${nestedKey}`, nestedDefinition as DesktopToolOption);
					optionControls.set(`gif.${nestedKey}`, control);
					inputPane.append(control.container);
				});
			}
		});
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
		const options = Object.fromEntries(Array.from(optionControls.entries()).map(([key, control]) => [key, control.value()]));
		const nestedOptions = Object.entries(options).reduce<Record<string, unknown>>((result, [key, value]) => {
			const [group, nestedKey] = key.split(".", 2);
			if (!nestedKey) {
			    result[key] = value;
			    return result;
		    }
			const groupValue = isRecord(result[group]) ? result[group] : {};
			result[group] = {...groupValue, [nestedKey]: value};
			return result;
		}, {});
		const payload = selectedFiles.length
			? {files: selectedFiles, options: nestedOptions}
			: {input: input.value};
		const response = await window.d3vtools.execute(tool.category, tool.slug, payload) as ApiResult;
      renderRateLimit(response.meta?.rate_limit)
      renderOutput(output, parseStructuredResult(unwrapResult(response)), presentation, tool)
    } catch (error) {
      output.className = "output error";
      if (isRateLimitError(error)) await renderRateLimitError(output);
	  else if (isAuthenticationError(error) || isPremiumError(error)) {
		  clearQuotaCache();
		  await renderAccessError(output, isAuthenticationError(error));
	  }
      else output.textContent = friendlyErrorMessage(error);
    }
    finally { run.disabled = false; run.textContent = 'Run' }
  }
  run.onclick = () => void execute()
  input.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void execute() })
  void resizeForTool();
}

function optionControl(key: string, definition: DesktopToolOption): {
	container: HTMLElement;
	element: HTMLInputElement | HTMLSelectElement;
	value: () => unknown
} {
	const container = document.createElement("label");
	container.className = "tool-option";
	const title = document.createElement("span");
	title.className = "tool-option-label";
	title.textContent = definition.label ?? optionLabel(key);
	container.append(title);
	if (definition.type === "select") {
		const element = document.createElement("select");
		element.className = "tool-select"
		;(definition.values ?? []).forEach((value) => element.append(new Option(value.toUpperCase(), value)));
		if (definition.default !== undefined) element.value = String(definition.default);
		container.append(element);
		return {container, element, value: () => element.value};
	}
	const element = document.createElement("input");
	element.type = definition.type === "checkbox" ? "checkbox" : "number";
	element.className = "tool-option-input";
	if (definition.min !== undefined) element.min = String(definition.min);
	if (definition.max !== undefined) element.max = String(definition.max);
	if (definition.step !== undefined) element.step = String(definition.step);
	if (definition.placeholder !== undefined) element.placeholder = definition.placeholder;
	if (definition.default !== undefined) {
		if (element.type === "checkbox") element.checked = Boolean(definition.default);
		else element.value = String(definition.default);
	}
	container.append(element);
	if (definition.help) {
		const help = document.createElement("small");
		help.className = "tool-option-help";
		help.textContent = definition.help;
		container.append(help);
	}
	return {container, element, value: () => element.type === "checkbox" ? element.checked : element.value};
}

function optionLabel(key: string): string {
	return key.split(".").map((part) => part.replaceAll("_", " ")).join(" ").replace(/\b[a-z]/g, (letter) => letter.toUpperCase()).replace(/^Gif\b/, "GIF");
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
  cachedQuota = {...rate, observedAt: Date.now()};
  try {
    localStorage.setItem(quotaCacheKey, JSON.stringify(cachedQuota));
  } catch { /* storage may be unavailable */
  }
  updateQuotaDisplay();
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  return `${Math.ceil(seconds / 60)}m`
}

function friendlyErrorMessage(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : "Request failed";
  if (/\b429\b|rate limit|too many requests/i.test(rawMessage)) {
    const resetIn = cachedQuota?.resets_in_seconds === undefined ? null : Math.max(0, cachedQuota.resets_in_seconds - Math.floor((Date.now() - cachedQuota.observedAt) / 1000));
    return resetIn !== null && resetIn > 0
        ? `You’ve reached your usage limit. Please try again in ${formatDuration(resetIn)}.`
        : "You’ve reached your usage limit. Please try again when the limit resets.";
  }
  return rawMessage.replace(/^Error invoking remote method '[^']+': Error:\s*/, "");
}

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /\b429\b|rate limit|too many requests/i.test(message);
}

function isPremiumError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : "";
	return /\b403\b|premium subscription|premium access|subscription required/i.test(message);
}

function isAuthenticationError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : "";
	return /\b401\b|unauthenticated|unauthorized/i.test(message);
}

async function renderAccessError(container: HTMLElement, authenticationFailed: boolean): Promise<void> {
	const hasApiKey = await window.d3vtools.hasApiKey().catch(() => false);
	const message = document.createElement("p");
	message.textContent = authenticationFailed && hasApiKey
		? "Your API key could not be authenticated. Check your key or subscription."
		: "This tool requires an API key with an active premium subscription.";
	const action = button(hasApiKey ? "Manage subscription" : "Get premium access", "primary-button");
	action.onclick = () => {
		void window.d3vtools.openAccount(hasApiKey ? "billing" : "app");
	};
	container.replaceChildren(message, action);
}

async function renderRateLimitError(container: HTMLElement): Promise<void> {
  const hasApiKey = await window.d3vtools.hasApiKey().catch(() => false);
  const message = document.createElement("p");
  message.textContent = friendlyErrorMessage(new Error("429"));
  const action = button(hasApiKey ? "View plans and increase limits" : "Sign up for higher limits", "primary-button");
  action.onclick = () => {
    void window.d3vtools.openAccount(hasApiKey ? "billing" : "app");
  };
  container.replaceChildren(message, action);
}

function updateQuotaDisplay(): void {
  if (!cachedQuota) return;
  if (quotaTimer !== undefined) {
    window.clearInterval(quotaTimer);
    quotaTimer = undefined;
  }
  const elapsed = Math.max(0, Math.floor((Date.now() - cachedQuota.observedAt) / 1000));
	const remaining = cachedQuota.remaining ?? 0;
  const resetIn = typeof cachedQuota.resets_in_seconds === "number" ? Math.max(0, cachedQuota.resets_in_seconds - elapsed) : null;
	if (remaining <= 0 && resetIn === 0) {
    cachedQuota = null;
    try {
      localStorage.removeItem(quotaCacheKey);
    } catch { /* storage may be unavailable */
    }
    quota.classList.remove("quota-warning");
    quota.textContent = quotaDefaultText;
    return;
  }
	const warning = remaining <= 0;
  quota.classList.toggle("quota-warning", warning);
  if (warning) {
    quota.textContent = resetIn === null ? "Usage limit reached" : `Usage limit reached · resets in ${formatDuration(resetIn)}`;
  } else {
    const reset = resetIn === null || resetIn === 0 ? "" : ` · resets in ${formatDuration(resetIn)}`;
	  quota.textContent = `${remaining}/${cachedQuota.limit ?? 0} requests left${cachedQuota.tier ? ` · ${cachedQuota.tier}` : ""}${reset}`;
  }
  if (resetIn !== null && resetIn > 0) quotaTimer = window.setInterval(updateQuotaDisplay, 1000);
}

function clearQuotaCache(): void {
	cachedQuota = null;
	if (quotaTimer !== undefined) {
		window.clearInterval(quotaTimer);
		quotaTimer = undefined;
	}
	try {
		localStorage.removeItem(quotaCacheKey);
	} catch { /* storage may be unavailable */
	}
	quota.classList.remove("quota-warning");
	quota.textContent = quotaDefaultText;
}

async function restoreCachedQuota(): Promise<void> {
	if (!(await window.d3vtools.hasApiKey().catch(() => false))) {
		clearQuotaCache();
		return;
	}
  try {
    const saved = JSON.parse(localStorage.getItem(quotaCacheKey) ?? "null") as (RateLimitInfo & {
      observedAt?: number
    }) | null;
    if (saved && typeof saved.remaining === "number" && typeof saved.limit === "number" && typeof saved.observedAt === "number") {
      cachedQuota = saved as RateLimitInfo & { observedAt: number };
      updateQuotaDisplay();
    }
  } catch { /* ignore malformed or unavailable cache */
  }
}

function renderOutput(container: HTMLElement, value: unknown, presentation: string, tool: ToolDefinition): void {
	if (tool.slug === "image-convert" && isConversionResult(value)) {
		renderConversionOutput(container, value);
		return;
	}
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

function isConversionResult(value: unknown): value is {
	files: Array<{ name: string; mime_type: string; data_uri?: string }>
} {
	return isRecord(value) && Array.isArray(value.files);
}

function renderConversionOutput(container: HTMLElement, job: {
	files: Array<{ name: string; mime_type: string; data_uri?: string }>
}): void {
	container.replaceChildren();
	container.className = "output download";
	const files = job.files.filter((file) => file.data_uri);
	if (!files.length) {
		container.append(renderPlainPreview("Conversion completed, but no output files were returned."));
		return;
	}
	files.forEach((file) => {
		const row = document.createElement("div");
		row.className = "conversion-file";
		const preview = document.createElement("img");
		preview.className = "image-preview";
		preview.src = file.data_uri!;
		preview.alt = file.name;
		const download = button(`Download ${file.name}`, "secondary-button");
		download.onclick = () => saveOutput(file.data_uri, {slug: file.name} as ToolDefinition, {
			extension: file.name.split(".").pop() ?? "bin",
			mime: file.mime_type
		});
		row.append(preview, download);
		container.append(row);
	});
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
void restoreCachedQuota();
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!settingsModal.hidden) closeSettings(); else void window.d3vtools.hideWindow();
  }
  if (settingsModal.hidden && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    void openSettings();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
    event.preventDefault();
    search.focus();
    search.select();
  }
  if (event.altKey && event.key === "ArrowLeft" && results.querySelector(".tool-shell")) {
    event.preventDefault();
    leaveTool();
  }
});
search.addEventListener("keydown", (event) => {
  const count = Math.min(searchCatalog(catalog, search.value).length, 12);
  if (event.key === "ArrowDown") {
    event.preventDefault();
    selected = Math.min(selected + 1, count - 1);
    render();
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    selected = Math.max(selected - 1, 0);
    render();
  }
  if (event.key === "Enter") {
    const tool = searchCatalog(catalog, search.value)[selected];
    if (tool) {
      event.preventDefault();
      openTool(tool);
    }
  }
});
applyTheme().finally(() => {
  window.d3vtools.getCatalog().then((value) => {
    catalog = value;
    render();
  }).catch(() => render());
});
window.d3vtools.getAppVersion().then((value) => { version.textContent = `v${value}` }).catch(() => { version.textContent = 'v—' })
poweredBy.onclick = () => void window.d3vtools.openWebsite()
updateIndicator.onclick = () => void window.d3vtools.openLatestRelease();
void window.d3vtools.checkForUpdate().then((update) => {
	if (!update) return;
	updateIndicator.title = `New version available: v${update.latestVersion}`;
	updateIndicator.setAttribute("aria-label", `New version available: v${update.latestVersion}`);
	updateIndicator.hidden = false;
}).catch(() => {
});
