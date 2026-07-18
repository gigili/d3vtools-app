import {describe, expect, it} from "vitest";
import {isNewerVersion, latestReleaseFor} from "../src/update/check";

describe("desktop update checks", () => {
	it("detects newer semantic versions", () => {
		expect(isNewerVersion("1.2.3", "1.3.0")).toBe(true);
		expect(isNewerVersion("1.2.3", "1.2.3")).toBe(false);
		expect(isNewerVersion("1.2.3", "1.2.2")).toBe(false);
	});

	it("ignores draft and prerelease releases", () => {
		expect(latestReleaseFor("1.0.0", {tag_name: "v2.0.0", draft: true})).toBeNull();
		expect(latestReleaseFor("1.0.0", {tag_name: "v2.0.0", prerelease: true})).toBeNull();
	});

	it("normalizes release tags", () => {
		expect(latestReleaseFor("1.0.0", {tag_name: "v1.1.0"})).toEqual({
			currentVersion: "1.0.0",
			latestVersion: "1.1.0"
		});
	});
});
