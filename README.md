# D3vTools Desktop

Open-source, Linux-first desktop access to the tools provided by [d3v.tools](https://d3v.tools). D3vTools Desktop is an
Electron launcher: it searches the remote tool catalog, opens a focused workspace for each tool, and sends execution
requests to the configured API.

The project is primarily designed and tested on Linux, while the release pipeline also produces Windows and macOS
installers.

## Current state

The application currently provides:

- A tray-based launcher with keyboard search and result navigation.
- Global shortcut recording from the Settings screen.
- Persistent API URL, shortcut, theme, window size, and always-on-top settings.
- Secure API-key storage through the operating system credential store.
- Text, code, file, JSON, table, image, and downloadable output presentations where supported by the catalog.
- Cached quota information, usage-limit warnings, and reset countdowns.
- Linux packages (`.deb` and `.AppImage`), a Windows installer (`.exe`), and a macOS disk image (`.dmg`) on
  tagged releases.

The desktop app depends on a compatible d3v.tools API. The catalog and execution capabilities are intentionally
server-driven, so a tool must be available from the configured API before it can be used here.

## Platform support

| Platform | Distribution          | Status                                                         |
|----------|-----------------------|----------------------------------------------------------------|
| Linux    | `.deb`, AppImage      | Primary development and test platform                          |
| Windows  | NSIS `.exe` installer | Built by the release workflow; needs platform-specific testing |
| macOS    | `.dmg` disk image     | Built by the release workflow; needs platform-specific testing |

Release artifacts are currently unsigned. Windows SmartScreen and macOS Gatekeeper may display warnings until signing
and notarization are added.

## Install and run from source

Requirements: Node.js 22+, npm, and a working desktop environment.

```sh
npm install
npm run dev
```

Useful commands:

```sh
npm test          # Run the test suite
npm run build     # Build the Electron application bundles
npm run package   # Build bundles and package for the current platform
```

The app starts in the tray and uses `CommandOrControl+Shift+Space` by default. Open Settings to change the API URL,
global shortcut, theme, dimensions, or API key.

## Configuration

Non-secret settings are stored in:

```text
${XDG_CONFIG_HOME:~/.config}/d3vtools/config.json
```

Example:

```json
{
  "apiBaseUrl": "https://d3v.tools",
  "shortcut": "CommandOrControl+Shift+Space",
  "theme": "rofi-dark",
  "windowWidth": 760,
  "windowHeight": 520,
  "alwaysOnTop": true,
  "startOnStartup": false
}
```

API keys are not written to this file; they are stored using the platform credential store through `keytar`. Custom
theme files can be placed in `${XDG_CONFIG_HOME:~/.config}/d3vtools/themes/` as `.css` files. The Settings screen
discovers those files automatically and shows their names without the `.css` suffix. On startup, the bundled
`rofi-dark.css` is copied there only if it does not already exist; user-edited files are never overwritten.

## Release process

Releases are driven by GitHub Releases. To publish a release:

1. Update `package.json` and add a matching `# x.y.z` section to `CHANGELOG.md`.
2. Create and publish a GitHub Release whose tag is `vx.y.z` or `x.y.z`.
3. The release workflow validates the version, replaces the release description with the matching changelog section,
   builds each platform natively, and uploads the installers.

The workflow builds Linux targets on Ubuntu, the Windows installer on Windows, and the macOS disk image on macOS. This
avoids relying on unsupported cross-platform packaging assumptions.

## Project structure

- `src/main` — Electron lifecycle, tray, window management, shortcuts, and IPC handlers
- `src/preload` — narrowly scoped renderer API
- `src/renderer` — launcher, settings screen, tool workspace, and presentations
- `src/api` — d3v.tools catalog and execution client
- `src/search` — local catalog search and ranking
- `src/settings` — persisted configuration and credential-store access
- `scripts` — release automation helpers
- `.github/workflows` — CI and release automation
- `tests` — unit tests

## Contributing

Issues and pull requests are welcome. For changes, please include relevant tests, keep Linux behavior intact, and verify
`npm test` and `npm run build` locally. UI changes should also be checked at the compact launcher size and in the
expanded tool workspace.

Before contributing, check the repository’s issue tracker for existing work and describe platform-specific behavior when
reporting a bug.

## License

No license has been declared in the repository yet. Until one is added, the source should not be assumed to be available
under an open-source license despite the project being developed in the open.
