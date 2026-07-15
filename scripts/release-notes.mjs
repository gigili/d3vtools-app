import {readFile, writeFile} from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const changelog = await readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8");
const version = packageJson.version;
const heading = new RegExp(`^#\\s+v?${version.replaceAll(".", "\\.") }\\s*$`, "m");
const match = heading.exec(changelog);

if (!match) throw new Error(`CHANGELOG.md does not contain a heading for version ${version}.`);

const start = match.index;
const contentStart = start + match[0].length;
const nextHeading = /^#\s+/m.exec(changelog.slice(contentStart));
const notes = changelog.slice(contentStart, nextHeading ? contentStart + nextHeading.index : undefined).trim();
if (!notes) throw new Error(`CHANGELOG.md has no release notes for version ${version}.`);

const output = process.argv[process.argv.indexOf("--output") + 1] || "release-notes.md";
await writeFile(output, notes + "\n");
if (process.env.GITHUB_OUTPUT) await writeFile(process.env.GITHUB_OUTPUT, `version=${version}\nnotes_file=${output}\n`, {flag: "a"});
console.log(`Extracted release notes for ${version} to ${output}`);
