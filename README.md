# D3vTools Desktop

Linux-first Electron launcher for the D3vTools API.

## Development

```sh
npm install
npm run dev
```

The app starts in the tray, registers `CommandOrControl+Shift+Space`, loads the catalog from `https://d3v.tools/`, and uses the Laravel Sanctum bearer-token contract when an API key is configured.

To test against a local API without changing the saved production setting, set the main-process override when starting Electron:

```sh
D3VTOOLS_API_BASE_URL=http://127.0.0.1 npm run dev
```

The override can include a port, such as `http://127.0.0.1:8080`, and takes precedence only for that process.

## Structure

- `src/main` — Electron lifecycle, tray, shortcut, IPC handlers
- `src/preload` — narrowly scoped renderer API
- `src/renderer` — launcher and generic tool panel
- `src/api` — D3vTools catalog and execution client
- `src/search` — local catalog search and ranking
- `src/settings` — settings file and OS credential-store access
- `tests` — unit tests

The catalog is intentionally consumed from the API. Desktop-specific metadata and server-executable support should be added to the Laravel API before expanding the generic panel.

## Linux configuration and themes

User configuration lives under `${XDG_CONFIG_HOME:~/.config}/d3vtools/`:

```json
{
  "theme": "rofi-dark",
  "windowWidth": 760,
  "windowHeight": 520,
  "alwaysOnTop": true
}
```

Custom themes are plain CSS files in `themes/`, for example `themes/solarized.css`, selected with `"theme": "solarized"`. The built-in selectors include `body`, `#app`, `#search`, `#results`, `.result`, `.result.selected`, `.result small`, `#status`, `.panel`, `textarea`, and `#run`, so users can override colors, spacing, borders, fonts, and layout without rebuilding the app.
