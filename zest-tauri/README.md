# Zest for Windows/macOS/Linux

Cross-platform AI Provider Quota Manager built with Tauri.

## About

Zest is a desktop application that helps you manage quotas for various AI providers including:
- Claude Code
- Gemini CLI
- GitHub Copilot
- Cursor
- OpenAI Codex
- And more...

## Features

- **System Tray Integration**: Runs in background with status indicator
- **Proxy Management**: Start/stop CLIProxyAPI with one click
- **Quota Monitoring**: Real-time quota usage for all connected accounts
- **Multi-Provider Support**: Connect multiple accounts from different providers
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Native Performance**: Built with Rust and Tauri for minimal resource usage

## Prerequisites

### For Development

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- Platform-specific build tools:
  - **Windows**: Microsoft Visual Studio C++ Build Tools
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux**: `build-essential`, `libwebkit2gtk-4.1-dev`, `libssl-dev`, etc.

### Linux Dependencies

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

## Development

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run tauri dev
```

### Build

```bash
# Build for production
npm run tauri build
```

The built application will be in `src-tauri/target/release/bundle/`.

## Project Structure

```
zest-tauri/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/              # Custom React hooks
│   ├── services/           # API services
│   ├── types/              # TypeScript types
│   └── styles/             # CSS styles
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs         # Entry point
│   │   ├── proxy.rs        # Proxy management
│   │   ├── tray.rs         # System tray
│   │   ├── settings.rs     # Settings persistence
│   │   ├── credentials.rs  # Secure credential storage
│   │   ├── commands.rs     # IPC commands
│   │   └── models.rs       # Data models
│   ├── icons/              # App icons
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
└── package.json            # Node dependencies
```

## Configuration

The app stores configuration in:
- **Windows**: `%LOCALAPPDATA%\Zest\`
- **macOS**: `~/Library/Application Support/Zest/`
- **Linux**: `~/.local/share/Zest/`

### Files
- `config.yaml` - Proxy configuration
- `settings.json` - App settings

## Proxy Binary

The app uses CLIProxyAPI binary from [router-for-me/CLIProxyAPIPlus](https://github.com/router-for-me/CLIProxyAPIPlus).

The binary is automatically downloaded and installed when you first start the proxy.

## Security

Credentials are stored securely using platform-native APIs:
- **Windows**: Windows Credential Manager
- **macOS**: Keychain
- **Linux**: Secret Service (libsecret) or encrypted file fallback

## License

MIT
