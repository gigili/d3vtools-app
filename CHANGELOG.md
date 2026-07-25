# 1.0.2

Expanded document tooling and improved packaged app reliability.

### Added

- PDF tool support with merge, split, extract, remove, reorder, and rotate actions.
- OCR tool support for PDF and common image formats.
- Multi-file uploads and configurable PDF action rows in the desktop workspace.

### Fixed

- Missing application icons across Linux, Windows, macOS, development, and packaged builds.
- Conversion job handling for document tools, including longer polling and clearer API errors.
- Multipart form submission for nested arrays such as PDF page selections.
- Output previews and downloads for text and document conversion results.

# 1.0.1

Improved premium tool support and desktop release discoverability.

### Added

- Premium Image Converter support with API-key subscription access checks.
- Image conversion options for output format, quality, resizing, and GIF settings.
- Automatic conversion polling with image previews and downloads.
- Friendly validation and authentication error messages with account CTAs.
- Non-blocking update indicator linking to the latest GitHub release.

# 1.0.0

Initial public release of D3vTools Desktop.

### Added

- Linux-first Electron launcher with system-tray integration.
- Searchable d3v.tools catalog with keyboard navigation.
- Tool workspaces for text, code, file, JSON, table, image, and downloadable results.
- Global shortcut recording and configurable window behavior.
- Settings persistence for API URL, shortcut, theme, window size, always-on-top, and startup behavior.
- Secure API-key storage with encrypted fallback support.
- Theme discovery with a default `rofi-dark` theme and custom theme directory access.
- Cached quota information, reset countdowns, usage-limit warnings, and upgrade CTAs.
- Linux, Windows, and macOS release packaging configuration.
