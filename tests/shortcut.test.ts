import {describe, expect, it} from "vitest";
import {acceleratorForKeyEvent, displayAccelerator} from "../src/renderer/shortcut";

function key(key: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent {
	return {
		key,
		code: "",
		ctrlKey: false,
		metaKey: false,
		altKey: false,
		shiftKey: false, ...modifiers
	} as KeyboardEvent;
}

describe("shortcut recording", () => {
	it("creates an Electron accelerator from a key combination", () => {
		expect(acceleratorForKeyEvent(key(" ", {ctrlKey: true, shiftKey: true}))).toBe("CommandOrControl+Shift+Space");
		expect(acceleratorForKeyEvent(key("k", {metaKey: true, altKey: true}))).toBe("CommandOrControl+Alt+K");
	});
	it("supports named keys and ignores modifier-only presses", () => {
		expect(acceleratorForKeyEvent(key("ArrowUp", {altKey: true}))).toBe("Alt+Up");
		expect(acceleratorForKeyEvent(key("F12", {ctrlKey: true}))).toBe("CommandOrControl+F12");
		expect(acceleratorForKeyEvent(key("Shift", {shiftKey: true}))).toBeNull();
	});
	it("uses the physical key for shifted punctuation", () => {
		expect(acceleratorForKeyEvent(key("!", {
			code: "Digit1",
			shiftKey: true,
			ctrlKey: true
		}))).toBe("CommandOrControl+Shift+1");
	});
	it("formats the recorded value for display", () => {
		expect(displayAccelerator("CommandOrControl+Shift+Space")).toBe("Ctrl/Cmd + Shift + Space");
	});
});
