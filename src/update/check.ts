export interface UpdateInfo {
	currentVersion: string;
	latestVersion: string;
}

interface GitHubRelease {
	tag_name?: string;
	draft?: boolean;
	prerelease?: boolean;
}

export function latestReleaseFor(currentVersion: string, release: GitHubRelease): UpdateInfo | null {
	const latestVersion = release.tag_name?.replace(/^v/i, "");
	if (!latestVersion || release.draft || release.prerelease || !isNewerVersion(currentVersion, latestVersion)) return null;
	return {currentVersion, latestVersion};
}

export function isNewerVersion(currentVersion: string, latestVersion: string): boolean {
	const current = versionParts(currentVersion);
	const latest = versionParts(latestVersion);
	for (let index = 0; index < 3; index += 1) {
		if (latest[index] !== current[index]) return latest[index] > current[index];
	}
	return false;
}

function versionParts(version: string): [number, number, number] {
	const parts = version.replace(/^v/i, "").split("-")[0].split(".").map((part) => Number.parseInt(part, 10));
	return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}
