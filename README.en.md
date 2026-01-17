# Zest

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="screenshots/menu_bar_dark.png" />
    <source media="(prefers-color-scheme: light)" srcset="screenshots/menu_bar.png" />
    <img alt="Zest Banner" src="screenshots/menu_bar.png" height="600" />
  </picture>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS-lightgrey.svg?style=flat" alt="Platform macOS" />
  <img src="https://img.shields.io/badge/language-Swift-orange.svg?style=flat" alt="Language Swift" />
  <img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat" alt="License MIT" />
  <img src="https://img.shields.io/badge/version-0.1.0%20beta-green.svg?style=flat" alt="Version" />
  <a href="README.md"><img src="https://img.shields.io/badge/lang-Português-green.svg?style=flat" alt="Portuguese" /></a>
  <a href="README.zh.md"><img src="https://img.shields.io/badge/lang-zh--CN-green.svg?style=flat" alt="Chinese" /></a>
  <a href="README.fr.md"><img src="https://img.shields.io/badge/lang-Français-blue.svg?style=flat" alt="French" /></a>
</p>

<p align="center">
  <strong>The ultimate command center for your AI coding assistants on macOS.</strong>
</p>

Zest is a native macOS application for managing **CLIProxyAPI** - a local proxy server that powers your AI coding agents. Manage multiple AI accounts, track quotas, and configure CLI tools in one place.

> This project is a modified fork of the original [Quotio](https://github.com/nguyenphutrong/quotio).

## Features

- **Multi-Provider Support**: Connect accounts from Gemini, Claude, OpenAI Codex, Qwen, Vertex AI, iFlow, Antigravity, Kiro, Trae, and GitHub Copilot via OAuth or API keys.
- **Standalone Quota Mode**: View quota and accounts without running the proxy server - perfect for quick checks.
- **One-Click Agent Configuration**: Auto-detect and configure AI coding tools like Claude Code, OpenCode, Gemini CLI, and more.
- **Real-time Dashboard**: Monitor request traffic, token usage, and success rates live.
- **Smart Quota Management**: Visual quota tracking per account with automatic failover strategies (Round Robin / Fill First).
- **API Key Management**: Generate and manage API keys for your local proxy.
- **Menu Bar Integration**: Quick access to server status, quota overview, and custom provider icons from your menu bar.
- **Notifications**: Alerts for low quotas, account cooling periods, or service issues.
- **Auto-Update**: Built-in Sparkle updater for seamless updates.
- **Multilingual**: English, Portuguese-BR, Vietnamese, French and Simplified Chinese support.

## Supported Ecosystem

### AI Providers
| Provider | Auth Method |
|----------|-------------|
| Google Gemini | OAuth |
| Anthropic Claude | OAuth |
| OpenAI Codex | OAuth |
| Qwen Code | OAuth |
| Vertex AI | Service Account JSON |
| iFlow | OAuth |
| Antigravity | OAuth |
| Kiro | OAuth |
| GitHub Copilot | OAuth |

### IDE Quota Tracking (Monitor Only)
| IDE | Description |
|-----|-------------|
| Cursor | Auto-detected when installed and logged in |
| Trae | Auto-detected when installed and logged in |

> **Note**: These IDEs are only used for quota usage monitoring. They cannot be used as providers for the proxy.

### Compatible CLI Agents
Zest can automatically configure these tools to use your centralized proxy:
- Claude Code
- Codex CLI
- Gemini CLI
- Amp CLI
- OpenCode
- Factory Droid

## Installation

### Requirements
- macOS 15.0 (Sequoia) or later
- Internet connection for OAuth authentication

### Building from Source

1. **Clone the repository:**
   ```bash
   git clone https://github.com/heliab125/zest.git
   cd zest
   ```

2. **Open in Xcode:**
   ```bash
   open Quotio.xcodeproj
   ```

3. **Build and Run:**
   - Select the "Quotio" scheme
   - Press `Cmd + R` to build and run

> The app will automatically download the `CLIProxyAPI` binary on first launch.

## Usage

### 1. Start the Server
Launch Zest and click **Start** on the dashboard to initialize the local proxy server.

### 2. Connect Accounts
Go to **Providers** tab → Click on a provider → Authenticate via OAuth or import credentials.

### 3. Configure Agents
Go to **Agents** tab → Select an installed agent → Click **Configure** → Choose Automatic or Manual mode.

### 4. Monitor Usage
- **Dashboard**: Overall health and traffic
- **Quota**: Per-account usage breakdown
- **Logs**: Raw request/response logs for debugging

## Settings

- **Port**: Change the proxy listening port
- **Routing Strategy**: Round Robin or Fill First
- **Auto-start**: Launch proxy automatically when Zest opens
- **Notifications**: Toggle alerts for various events

## Screenshots

### Dashboard
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="screenshots/dashboard_dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="screenshots/dashboard.png" />
  <img alt="Dashboard" src="screenshots/dashboard.png" />
</picture>

### Providers
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="screenshots/provider_dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="screenshots/provider.png" />
  <img alt="Providers" src="screenshots/provider.png" />
</picture>

### Agent Setup
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="screenshots/agent_setup_dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="screenshots/agent_setup.png" />
  <img alt="Agent Setup" src="screenshots/agent_setup.png" />
</picture>

### Quota Monitoring
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="screenshots/quota_dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="screenshots/quota.png" />
  <img alt="Quota Monitoring" src="screenshots/quota.png" />
</picture>

## Contributing

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/amazing-feature`)
3. Commit your Changes (`git commit -m 'Add amazing feature'`)
4. Push to the Branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Credits

This project is a modified fork of the original [Quotio](https://github.com/nguyenphutrong/quotio), created by [nguyenphutrong](https://github.com/nguyenphutrong).

**Modified by:** [heliab125](https://github.com/heliab125)

## License

MIT License. See `LICENSE` for details.
