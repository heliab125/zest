//
//  MCPSettings.swift
//  Quotio
//
//  MCP (Model Context Protocol) integration settings and manager
//

import Foundation
import SwiftUI

// MARK: - MCP Tool Definition

/// Represents an individual MCP tool that can be enabled/disabled
struct MCPTool: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let description: String
    let endpoint: String
    let fullURL: String  // Full z.ai API URL for direct mode
    let serverType: MCPServerType  // Type of MCP server (http or stdio)
    var enabled: Bool

    /// Icon name for the tool
    var iconName: String {
        switch id {
        case "web_search":
            return "magnifyingglass.circle.fill"
        case "web_reader":
            return "doc.text.fill"
        case "vision":
            return "eye.fill"
        case "zread":
            return "book.fill"
        default:
            return "wrench.and.screwdriver.fill"
        }
    }

    /// Color for the tool icon
    var iconColor: Color {
        switch id {
        case "web_search":
            return .blue
        case "web_reader":
            return .green
        case "vision":
            return .purple
        case "zread":
            return .orange
        default:
            return .gray
        }
    }
}

/// Type of MCP server connection
enum MCPServerType: String, Codable {
    case http = "http"       // HTTP-based MCP (web_search, web_reader, zread)
    case stdio = "stdio"     // Local process-based MCP (vision via npx)
}

// MARK: - MCP Connection Status

enum MCPConnectionStatus: String, Codable {
    case disconnected
    case connecting
    case connected
    case error

    var displayText: String {
        switch self {
        case .disconnected:
            return "mcp.status.disconnected".localized()
        case .connecting:
            return "mcp.status.connecting".localized()
        case .connected:
            return "mcp.status.connected".localized()
        case .error:
            return "mcp.status.error".localized()
        }
    }

    var color: Color {
        switch self {
        case .disconnected:
            return .gray
        case .connecting:
            return .orange
        case .connected:
            return .green
        case .error:
            return .red
        }
    }
}

// MARK: - MCP Configuration Mode

/// Determines how MCP tools are configured
enum MCPConfigMode: String, Codable, CaseIterable, Identifiable {
    case direct = "direct"       // Direct connection to z.ai API
    case proxy = "proxy"         // Proxy through local server

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .direct:
            return "mcp.configMode.direct".localized()
        case .proxy:
            return "mcp.configMode.proxy".localized()
        }
    }

    var description: String {
        switch self {
        case .direct:
            return "mcp.configMode.direct.description".localized()
        case .proxy:
            return "mcp.configMode.proxy.description".localized()
        }
    }
}

// MARK: - MCP Settings Manager

/// Manager for MCP settings with persistence
@MainActor
@Observable
final class MCPSettingsManager {
    static let shared = MCPSettingsManager()

    private let defaults = UserDefaults.standard
    private let enabledKey = "mcpEnabled"
    private let configModeKey = "mcpConfigMode"
    private let zaiApiKeyKey = "mcpZaiApiKey"
    private let zaiBaseURLKey = "mcpZaiBaseURL"
    private let enabledToolsKey = "mcpEnabledTools"
    private let mcpPortKey = "mcpPort"

    /// Whether MCP integration is enabled
    var enabled: Bool {
        didSet {
            defaults.set(enabled, forKey: enabledKey)
            onSettingsChanged?()
        }
    }

    /// Configuration mode (direct or proxy)
    var configMode: MCPConfigMode {
        didSet {
            defaults.set(configMode.rawValue, forKey: configModeKey)
            onSettingsChanged?()
        }
    }

    /// z.ai API Key for MCP services
    var zaiApiKey: String {
        didSet {
            // Store in Keychain for security
            saveApiKeyToKeychain(zaiApiKey)
            onSettingsChanged?()
        }
    }

    /// z.ai Base URL
    var zaiBaseURL: String {
        didSet {
            defaults.set(zaiBaseURL, forKey: zaiBaseURLKey)
            onSettingsChanged?()
        }
    }

    /// Port for MCP proxy server (when using proxy mode)
    var mcpPort: UInt16 {
        didSet {
            defaults.set(Int(mcpPort), forKey: mcpPortKey)
            onSettingsChanged?()
        }
    }

    /// Available MCP tools
    var tools: [MCPTool] {
        didSet {
            saveEnabledTools()
            onSettingsChanged?()
        }
    }

    /// Current connection status
    var connectionStatus: MCPConnectionStatus = .disconnected

    /// Last error message
    var lastError: String?

    /// Callback when settings change
    var onSettingsChanged: (() -> Void)?

    /// Default z.ai base URL
    static let defaultZaiBaseURL = "https://api.z.ai/api"

    /// Default MCP port
    static let defaultMCPPort: UInt16 = 8318

    private init() {
        // Load enabled state
        self.enabled = defaults.bool(forKey: enabledKey)

        // Load config mode
        let modeRaw = defaults.string(forKey: configModeKey) ?? MCPConfigMode.direct.rawValue
        self.configMode = MCPConfigMode(rawValue: modeRaw) ?? .direct

        // Load API key from Keychain
        self.zaiApiKey = Self.loadApiKeyFromKeychain() ?? ""

        // Load base URL
        let savedURL = defaults.string(forKey: zaiBaseURLKey) ?? ""
        self.zaiBaseURL = savedURL.isEmpty ? Self.defaultZaiBaseURL : savedURL

        // Load port
        let savedPort = defaults.integer(forKey: mcpPortKey)
        self.mcpPort = (savedPort > 0 && savedPort < 65536) ? UInt16(savedPort) : Self.defaultMCPPort

        // Initialize default tools (always use fresh defaults with correct URLs)
        self.tools = Self.defaultTools()

        // Load enabled state for tools
        loadEnabledTools()

        // Debug logging after all properties initialized
        print("[MCP Debug] Loaded configMode: \(configMode) (raw: \(modeRaw))")
        for tool in tools {
            print("[MCP Debug] Tool: \(tool.id), fullURL: \(tool.fullURL), serverType: \(tool.serverType)")
        }
    }

    /// Default MCP tools with z.ai API endpoints
    static func defaultTools() -> [MCPTool] {
        [
            MCPTool(
                id: "web_search",
                name: "mcp.tool.webSearch".localized(),
                description: "mcp.tool.webSearch.description".localized(),
                endpoint: "/mcp/web_search_prime/mcp",
                fullURL: "https://api.z.ai/api/mcp/web_search_prime/mcp",
                serverType: .http,
                enabled: true
            ),
            MCPTool(
                id: "web_reader",
                name: "mcp.tool.webReader".localized(),
                description: "mcp.tool.webReader.description".localized(),
                endpoint: "/mcp/web_reader/mcp",
                fullURL: "https://api.z.ai/api/mcp/web_reader/mcp",
                serverType: .http,
                enabled: true
            ),
            MCPTool(
                id: "zread",
                name: "mcp.tool.zread".localized(),
                description: "mcp.tool.zread.description".localized(),
                endpoint: "/mcp/zread/mcp",
                fullURL: "https://api.z.ai/api/mcp/zread/mcp",
                serverType: .http,
                enabled: true
            ),
            MCPTool(
                id: "vision",
                name: "mcp.tool.vision".localized(),
                description: "mcp.tool.vision.description".localized(),
                endpoint: "/mcp/zai-mcp-server/mcp",
                fullURL: "",  // Vision uses stdio with npx, not HTTP
                serverType: .stdio,
                enabled: true
            )
        ]
    }

    /// Save enabled state of tools
    private func saveEnabledTools() {
        let enabledIds = tools.filter { $0.enabled }.map { $0.id }
        defaults.set(enabledIds, forKey: enabledToolsKey)
    }

    /// Load enabled state for tools
    private func loadEnabledTools() {
        guard let enabledIds = defaults.stringArray(forKey: enabledToolsKey) else {
            // Default: all enabled
            return
        }

        for i in tools.indices {
            tools[i].enabled = enabledIds.contains(tools[i].id)
        }
    }

    /// Toggle a specific tool
    func toggleTool(_ toolId: String) {
        if let index = tools.firstIndex(where: { $0.id == toolId }) {
            tools[index].enabled.toggle()
        }
    }

    /// Get enabled tools only
    var enabledTools: [MCPTool] {
        tools.filter { $0.enabled }
    }

    /// Check if any tools are enabled
    var hasEnabledTools: Bool {
        tools.contains { $0.enabled }
    }

    /// Full endpoint URL for a tool
    func endpointURL(for tool: MCPTool) -> String {
        switch configMode {
        case .direct:
            // Use the full z.ai URL for HTTP tools, empty for stdio
            return tool.fullURL.isEmpty ? "" : tool.fullURL
        case .proxy:
            return "http://127.0.0.1:\(mcpPort)" + tool.endpoint
        }
    }

    // MARK: - Keychain Operations

    private func saveApiKeyToKeychain(_ apiKey: String) {
        let service = "com.quotio.mcp"
        let account = "zai-api-key"

        let data = apiKey.data(using: .utf8)!

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]

        SecItemDelete(query as CFDictionary)

        if !apiKey.isEmpty {
            var newItem = query
            newItem[kSecValueData as String] = data
            SecItemAdd(newItem as CFDictionary, nil)
        }
    }

    private static func loadApiKeyFromKeychain() -> String? {
        let service = "com.quotio.mcp"
        let account = "zai-api-key"

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let string = String(data: data, encoding: .utf8) else {
            return nil
        }

        return string
    }

    /// Validate API key format
    func validateApiKey() -> Bool {
        !zaiApiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// Reset to defaults
    func resetToDefaults() {
        enabled = false
        configMode = .direct
        zaiApiKey = ""
        zaiBaseURL = Self.defaultZaiBaseURL
        mcpPort = Self.defaultMCPPort
        tools = Self.defaultTools()
        connectionStatus = .disconnected
        lastError = nil
    }
}

// MARK: - Claude Code Settings Integration

extension MCPSettingsManager {
    /// Path to Claude Code settings file
    var claudeSettingsPath: String {
        let homeDir = FileManager.default.homeDirectoryForCurrentUser
        return homeDir.appendingPathComponent(".claude/settings.json").path
    }

    /// Generate MCP server configuration for Claude Code
    /// Based on z.ai documentation: https://docs.z.ai/devpack/mcp/
    func generateClaudeCodeConfig() -> [String: Any] {
        guard enabled && hasEnabledTools else {
            return [:]
        }

        var mcpServers: [String: Any] = [:]

        for tool in enabledTools {
            let serverConfig: [String: Any]

            switch tool.serverType {
            case .http:
                // HTTP-based MCP servers (web_search, web_reader, zread)
                switch configMode {
                case .direct:
                    // Direct connection to z.ai API with Authorization header
                    serverConfig = [
                        "type": "http",
                        "url": tool.fullURL,
                        "headers": [
                            "Authorization": "Bearer \(zaiApiKey)"
                        ]
                    ]
                case .proxy:
                    // Proxy mode - no auth needed, proxy injects it
                    serverConfig = [
                        "type": "http",
                        "url": "http://127.0.0.1:\(mcpPort)" + tool.endpoint
                    ]
                }

            case .stdio:
                // Stdio-based MCP servers (vision via npx)
                switch configMode {
                case .direct:
                    // Vision MCP uses npx with environment variables
                    serverConfig = [
                        "type": "stdio",
                        "command": "npx",
                        "args": ["-y", "@z_ai/mcp-server"],
                        "env": [
                            "Z_AI_API_KEY": zaiApiKey,
                            "Z_AI_MODE": "ZAI"
                        ]
                    ]
                case .proxy:
                    // Proxy mode - connect to local endpoint
                    serverConfig = [
                        "type": "http",
                        "url": "http://127.0.0.1:\(mcpPort)" + tool.endpoint
                    ]
                }
            }

            mcpServers["quotio-\(tool.id)"] = serverConfig
        }

        return ["mcpServers": mcpServers]
    }

    /// Update Claude Code settings with MCP configuration
    func updateClaudeCodeSettings() throws {
        let settingsPath = claudeSettingsPath
        let fileManager = FileManager.default

        // Create .claude directory if it doesn't exist
        let claudeDir = (settingsPath as NSString).deletingLastPathComponent
        if !fileManager.fileExists(atPath: claudeDir) {
            try fileManager.createDirectory(atPath: claudeDir, withIntermediateDirectories: true)
        }

        // Read existing settings or create new
        var settings: [String: Any] = [:]
        if fileManager.fileExists(atPath: settingsPath),
           let data = fileManager.contents(atPath: settingsPath),
           let existingSettings = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            settings = existingSettings
        }

        // Update MCP servers
        if enabled && hasEnabledTools {
            let mcpConfig = generateClaudeCodeConfig()
            if let servers = mcpConfig["mcpServers"] as? [String: Any] {
                // Merge with existing mcpServers, preserving non-quotio servers
                var existingServers = settings["mcpServers"] as? [String: Any] ?? [:]

                // Remove old quotio servers
                existingServers = existingServers.filter { !$0.key.hasPrefix("quotio-") }

                // Add new quotio servers
                for (key, value) in servers {
                    existingServers[key] = value
                }

                settings["mcpServers"] = existingServers
            }
        } else {
            // Remove quotio MCP servers if disabled
            if var existingServers = settings["mcpServers"] as? [String: Any] {
                existingServers = existingServers.filter { !$0.key.hasPrefix("quotio-") }
                if existingServers.isEmpty {
                    settings.removeValue(forKey: "mcpServers")
                } else {
                    settings["mcpServers"] = existingServers
                }
            }
        }

        // Write updated settings
        let jsonData = try JSONSerialization.data(withJSONObject: settings, options: [.prettyPrinted, .sortedKeys])
        try jsonData.write(to: URL(fileURLWithPath: settingsPath))
    }
}
