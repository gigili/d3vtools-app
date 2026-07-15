import {app, safeStorage} from "electron";
import {createCipheriv, createDecipheriv, createHash, randomBytes} from "node:crypto";
import {userInfo} from "node:os";
import {join} from "node:path";
import {mkdir, readFile, unlink, writeFile} from "node:fs/promises";
import type {AppSettings} from "../shared/types";

// keytar is a native CommonJS module. Load it lazily so a missing platform
// binary does not prevent the app from starting without an API key.
type Keytar = typeof import("keytar")
let keytar: Keytar | null | undefined;

function credentialStore(): Keytar | null {
	if (keytar !== undefined) return keytar;
	try {
		keytar = require("keytar") as Keytar;
	} catch {
		keytar = null;
	}
	return keytar;
}

async function fallbackEncryptionKey(): Promise<Buffer> {
	let machineId = "";
	try {
		machineId = await readFile("/etc/machine-id", "utf8");
	} catch { /* Windows and macOS do not use this path. */
	}
	return createHash("sha256").update(`d3vtools-desktop:${machineId}:${userInfo().username}:${app.getPath("userData")}`).digest();
}

async function encryptFallback(value: string): Promise<string> {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", await fallbackEncryptionKey(), iv);
	const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
	return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${encrypted.toString("base64")}`;
}

async function decryptFallback(value: string): Promise<string | null> {
	try {
		const [version, iv, tag, encrypted] = value.split(":");
		if (version !== "v1" || !iv || !tag || !encrypted) return null;
		const decipher = createDecipheriv("aes-256-gcm", await fallbackEncryptionKey(), Buffer.from(iv, "base64"));
		decipher.setAuthTag(Buffer.from(tag, "base64"));
		return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
	} catch {
		return null;
	}
}

const service = 'd3vtools-desktop'
const account = 'api-key'
const defaults: AppSettings = { apiBaseUrl: 'https://d3v.tools', shortcut: 'CommandOrControl+Shift+Space' }

export class SettingsStore {
	private readonly directory = join(process.env.XDG_CONFIG_HOME ?? join(app.getPath("home"), ".config"), "d3vtools");
	private readonly path = join(this.directory, "config.json");
	private readonly encryptedApiKeyPath = join(this.directory, "api-key.enc");
	private readonly legacyPath = join(app.getPath("userData"), "settings.json");

  async get(): Promise<AppSettings> {
	  let saved: Partial<AppSettings> = {};
    try {
		saved = JSON.parse(await readFile(this.path, "utf8")) as Partial<AppSettings>;
	} catch { /* config file may not exist yet */
    }
	  if (!saved.apiBaseUrl || !saved.shortcut) {
		  try {
			  const legacy = JSON.parse(await readFile(this.legacyPath, "utf8")) as Partial<AppSettings>;
			  saved = {...legacy, ...saved};
		  } catch { /* no legacy settings to migrate */
		  }
    }
	  return {...defaults, ...saved};
  }

  async save(settings: AppSettings): Promise<void> {
	  await mkdir(this.directory, {recursive: true});
	  let existing: Record<string, unknown> = {};
	  try {
		  existing = JSON.parse(await readFile(this.path, "utf8")) as Record<string, unknown>;
	  } catch { /* first run */
	  }
	  await writeFile(this.path, JSON.stringify({...existing, ...settings}, null, 2), {mode: 0o600});
  }

	async getApiKey(): Promise<string | null> {
		const store = credentialStore();
		if (store) return store.getPassword(service, account);
		try {
			const encrypted = await readFile(this.encryptedApiKeyPath, "utf8");
			if (safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
			return decryptFallback(encrypted);
		} catch {
			return null;
		}
	}

	async setApiKey(value: string): Promise<void> {
		const store = credentialStore();
		if (store) return store.setPassword(service, account, value.trim());
		const encrypted = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(value.trim()).toString("base64") : await encryptFallback(value.trim());
		await mkdir(this.directory, {recursive: true});
		await writeFile(this.encryptedApiKeyPath, encrypted, {mode: 0o600});
	}

	async deleteApiKey(): Promise<boolean> {
		const store = credentialStore();
		if (store) return store.deletePassword(service, account);
		try {
			await unlink(this.encryptedApiKeyPath);
			return true;
		} catch {
			return false;
		}
	}
}
