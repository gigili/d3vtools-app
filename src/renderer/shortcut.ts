const namedKeys: Record<string, string> = {
	" ": "Space", Escape: "Esc", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right", ArrowUp: "Up",
	Backspace: "Backspace", Delete: "Delete", End: "End", Enter: "Enter", Home: "Home", Insert: "Insert",
	PageDown: "PageDown", PageUp: "PageUp", Tab: "Tab",
};
const modifierKeys = new Set(["Alt", "AltGraph", "Control", "Meta", "Shift"]);

export function acceleratorForKeyEvent(event: KeyboardEvent): string | null {
	if (modifierKeys.has(event.key)) return null;
	const modifiers: string[] = [];
	if (event.ctrlKey || event.metaKey) modifiers.push("CommandOrControl");
	if (event.altKey) modifiers.push("Alt");
	if (event.shiftKey) modifiers.push("Shift");
	const key = electronKeyName(event.key, event.code);
	return key ? [...modifiers, key].join("+") : null;
}

function electronKeyName(key: string, code: string): string | null {
	if (namedKeys[key]) return namedKeys[key];
	if (/^F(?:[1-9]|1[0-2])$/.test(key)) return key;
	if (/^[a-z]$/i.test(key) || /^[0-9]$/.test(key)) return key.toUpperCase();
	if (/^Digit[0-9]$/.test(code)) return code.slice(-1);
	if (/^Numpad[0-9]$/.test(key)) return key;
	const byCode: Record<string, string> = {
		Equal: "Plus",
		NumpadAdd: "Plus",
		Comma: "Comma",
		Period: "Period",
		Slash: "Slash",
		Backslash: "Backslash",
		Semicolon: "Semicolon",
		Quote: "Quote",
		BracketLeft: "BracketLeft",
		BracketRight: "BracketRight",
		Backquote: "Backquote",
		Minus: "Minus",
		NumpadSubtract: "Minus",
	};
	return ({
		"+": "Plus",
		"=": "Plus",
		",": "Comma",
		".": "Period",
		"/": "Slash",
		"\\": "Backslash",
		";": "Semicolon",
		"'": "Quote",
		"[": "BracketLeft",
		"]": "BracketRight",
		"`": "Backquote",
		"-": "Minus"
	} as Record<string, string>)[key] ?? byCode[code] ?? null;
}

export function displayAccelerator(accelerator: string): string {
	return accelerator.replaceAll("CommandOrControl", "Ctrl/Cmd").replaceAll("Control", "Ctrl").replaceAll("+", " + ");
}
