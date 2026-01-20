//
//  MCPService.swift
//  Quotio
//
//  MCP (Model Context Protocol) service for managing MCP tool integration
//

import Foundation
import AppKit
import UserNotifications

/// Service for managing MCP tool integration with Claude Code
@MainActor
@Observable
final class MCPService {
    static let shared = MCPService()

    private let settingsManager = MCPSettingsManager.shared
    private var healthCheckTask: Task<Void, Never>?

    /// Whether the service is currently testing connection
    private(set) var isTesting = false

    /// Last test result message
    private(set) var lastTestResult: String?

    /// Whether test was successful
    private(set) var lastTestSuccess: Bool = false

    private init() {
        // Setup settings change callback
        settingsManager.onSettingsChanged = { [weak self] in
            Task { @MainActor in
                await self?.handleSettingsChanged()
            }
        }
    }

    // MARK: - Public API

    /// Test connection to MCP services
    func testConnection() async -> (success: Bool, message: String) {
        guard settingsManager.enabled else {
            return (false, "mcp.error.notEnabled".localized())
        }

        guard settingsManager.hasEnabledTools else {
            return (false, "mcp.error.noToolsEnabled".localized())
        }

        isTesting = true
        settingsManager.connectionStatus = .connecting
        defer { isTesting = false }

        // Test each enabled tool
        var results: [(tool: String, success: Bool, message: String)] = []

        for tool in settingsManager.enabledTools {
            let (success, message) = await testToolEndpoint(tool)
            results.append((tool.name, success, message))
        }

        let allSuccess = results.allSatisfy { $0.success }
        let failedTools = results.filter { !$0.success }

        let resultMessage: String
        if allSuccess {
            resultMessage = "mcp.test.success".localized()
            settingsManager.connectionStatus = .connected
            settingsManager.lastError = nil
        } else if failedTools.count == results.count {
            resultMessage = "mcp.test.allFailed".localized()
            settingsManager.connectionStatus = .error
            settingsManager.lastError = failedTools.first?.message
        } else {
            let failedNames = failedTools.map { $0.tool }.joined(separator: ", ")
            resultMessage = String(format: "mcp.test.partialFail".localized(), failedNames)
            settingsManager.connectionStatus = .connected
            settingsManager.lastError = resultMessage
        }

        lastTestResult = resultMessage
        lastTestSuccess = allSuccess

        return (allSuccess, resultMessage)
    }

    /// Apply MCP configuration to Claude Code
    func applyConfiguration() async throws {
        try settingsManager.updateClaudeCodeSettings()

        // Show notification
        if settingsManager.enabled && settingsManager.hasEnabledTools {
            NotificationManager.shared.notify(
                title: "mcp.notification.configApplied.title".localized(),
                body: "mcp.notification.configApplied.body".localized()
            )
        }
    }

    /// Remove MCP configuration from Claude Code
    func removeConfiguration() async throws {
        let wasEnabled = settingsManager.enabled
        settingsManager.enabled = false

        try settingsManager.updateClaudeCodeSettings()

        if wasEnabled {
            NotificationManager.shared.notify(
                title: "mcp.notification.configRemoved.title".localized(),
                body: "mcp.notification.configRemoved.body".localized()
            )
        }
    }

    /// Start health monitoring
    func startHealthMonitor() {
        stopHealthMonitor()

        guard settingsManager.enabled else { return }

        healthCheckTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 60_000_000_000) // 60 seconds
                guard !Task.isCancelled else { break }
                await self?.performHealthCheck()
            }
        }
    }

    /// Stop health monitoring
    func stopHealthMonitor() {
        healthCheckTask?.cancel()
        healthCheckTask = nil
    }

    // MARK: - Private Methods

    private func handleSettingsChanged() async {
        // Update Claude Code settings when MCP settings change
        do {
            try await applyConfiguration()
        } catch {
            settingsManager.lastError = error.localizedDescription
        }

        // Restart health monitor if needed
        if settingsManager.enabled {
            startHealthMonitor()
        } else {
            stopHealthMonitor()
            settingsManager.connectionStatus = .disconnected
        }
    }

    private func testToolEndpoint(_ tool: MCPTool) async -> (success: Bool, message: String) {
        // Debug log
        print("[MCP Debug] Testing tool: \(tool.id), serverType: \(tool.serverType), configMode: \(settingsManager.configMode)")

        // For stdio tools in direct mode, we can't test via HTTP
        // Just validate that we have the API key
        if tool.serverType == .stdio && settingsManager.configMode == .direct {
            if settingsManager.zaiApiKey.isEmpty {
                return (false, "mcp.error.noApiKey".localized())
            }
            // For stdio, assume success if API key is set (npx will use it)
            return (true, "OK (stdio)")
        }

        let endpointURL = settingsManager.endpointURL(for: tool)
        print("[MCP Debug] Endpoint URL for \(tool.id): \(endpointURL)")

        // Skip if URL is empty (shouldn't happen for HTTP tools)
        guard !endpointURL.isEmpty else {
            return (false, "mcp.error.invalidURL".localized())
        }

        guard let url = URL(string: endpointURL) else {
            return (false, "mcp.error.invalidURL".localized())
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST" // Use POST for MCP endpoints
        request.timeoutInterval = 10
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")

        // Add API key header for direct mode
        if settingsManager.configMode == .direct && !settingsManager.zaiApiKey.isEmpty {
            request.addValue("Bearer \(settingsManager.zaiApiKey)", forHTTPHeaderField: "Authorization")
        }

        // Send a minimal MCP initialize request to test connection
        let initRequest = """
        {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}}}
        """
        request.httpBody = initRequest.data(using: .utf8)

        do {
            let (_, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                return (false, "mcp.error.invalidResponse".localized())
            }

            print("[MCP Debug] Response status for \(tool.id): \(httpResponse.statusCode)")

            // Accept 200, 201, 204, 400 (bad request means server is there), 405
            let acceptableCodes = [200, 201, 204, 400, 405]
            if acceptableCodes.contains(httpResponse.statusCode) {
                return (true, "OK")
            } else if httpResponse.statusCode == 401 {
                return (false, "mcp.error.unauthorized".localized())
            } else if httpResponse.statusCode == 404 {
                return (false, String(format: "mcp.error.httpStatus".localized(), 404))
            } else {
                return (false, String(format: "mcp.error.httpStatus".localized(), httpResponse.statusCode))
            }
        } catch {
            print("[MCP Debug] Error for \(tool.id): \(error.localizedDescription)")
            return (false, error.localizedDescription)
        }
    }

    private func performHealthCheck() async {
        guard settingsManager.enabled && settingsManager.hasEnabledTools else {
            settingsManager.connectionStatus = .disconnected
            return
        }

        // Quick check of the first enabled tool
        if let firstTool = settingsManager.enabledTools.first {
            let (success, _) = await testToolEndpoint(firstTool)
            settingsManager.connectionStatus = success ? .connected : .error
        }
    }
}

// MARK: - Notification Extension

extension NotificationManager {
    /// Generic notification helper using modern UserNotifications framework
    func notify(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil  // Deliver immediately
        )

        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("[MCPService] Failed to deliver notification: \(error)")
            }
        }
    }
}
