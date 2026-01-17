//
//  MCPConfigSheet.swift
//  Quotio
//
//  MCP Tools configuration sheet
//

import SwiftUI
import AppKit

struct MCPConfigSheet: View {
    @Environment(\.dismiss) private var dismiss

    private let mcpSettings = MCPSettingsManager.shared
    private let mcpService = MCPService.shared

    @State private var isTesting = false
    @State private var testResult: String?
    @State private var testSuccess = false
    @State private var showApiKey = false
    @State private var isApplying = false

    var body: some View {
        VStack(spacing: 0) {
            headerView
                .background(Color(nsColor: .windowBackgroundColor))

            Divider()

            ScrollView {
                VStack(spacing: 24) {
                    enableToggleSection

                    if mcpSettings.enabled {
                        apiKeySection
                        toolsSection
                        configModeSection
                        statusSection
                    }
                }
                .padding(24)
            }
            .background(Color(nsColor: .controlBackgroundColor))

            Divider()

            footerView
                .background(Color(nsColor: .windowBackgroundColor))
        }
        .frame(width: 560, height: 580)
    }

    // MARK: - Header

    private var headerView: some View {
        HStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [.purple.opacity(0.15), .blue.opacity(0.1)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 48, height: 48)
                    .overlay(
                        Circle()
                            .strokeBorder(Color.white.opacity(0.2), lineWidth: 1)
                    )

                Image(systemName: "wand.and.stars")
                    .font(.system(size: 24))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.purple, .blue],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .shadow(color: .purple.opacity(0.3), radius: 4, x: 0, y: 2)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("mcp.title".localized())
                    .font(.system(size: 18, weight: .semibold))

                Text("mcp.subtitle".localized())
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.title2)
                    .foregroundStyle(.secondary.opacity(0.8))
            }
            .buttonStyle(.plain)
            .onHover { inside in
                if inside { NSCursor.pointingHand.push() } else { NSCursor.pop() }
            }
        }
        .padding(20)
    }

    // MARK: - Enable Toggle

    private var enableToggleSection: some View {
        @Bindable var settings = mcpSettings

        return HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("mcp.enable.title".localized())
                    .font(.headline)

                Text("mcp.enable.description".localized())
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Toggle("", isOn: $settings.enabled)
                .labelsHidden()
                .toggleStyle(.switch)
        }
        .padding(16)
        .background(Color(nsColor: .windowBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(Color.primary.opacity(0.08), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.05), radius: 2, x: 0, y: 1)
    }

    // MARK: - API Key Section

    private var apiKeySection: some View {
        @Bindable var settings = mcpSettings

        return VStack(alignment: .leading, spacing: 12) {
            Label("mcp.apiKey.title".localized(), systemImage: "key.fill")
                .font(.headline)

            HStack(spacing: 8) {
                if showApiKey {
                    TextField("mcp.apiKey.placeholder".localized(), text: $settings.zaiApiKey)
                        .textFieldStyle(.roundedBorder)
                } else {
                    SecureField("mcp.apiKey.placeholder".localized(), text: $settings.zaiApiKey)
                        .textFieldStyle(.roundedBorder)
                }

                Button {
                    showApiKey.toggle()
                } label: {
                    Image(systemName: showApiKey ? "eye.slash" : "eye")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .help(showApiKey ? "mcp.apiKey.hide".localized() : "mcp.apiKey.show".localized())
            }

            Text("mcp.apiKey.hint".localized())
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(16)
        .background(Color(nsColor: .windowBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(Color.primary.opacity(0.08), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.05), radius: 2, x: 0, y: 1)
    }

    // MARK: - Tools Section

    private var toolsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("mcp.tools.title".localized(), systemImage: "wrench.and.screwdriver")
                .font(.headline)

            VStack(spacing: 0) {
                ForEach(Array(mcpSettings.tools.enumerated()), id: \.element.id) { index, tool in
                    toolRow(tool: tool, index: index)

                    if index < mcpSettings.tools.count - 1 {
                        Divider()
                    }
                }
            }
            .background(Color(nsColor: .controlBackgroundColor))
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .strokeBorder(Color.primary.opacity(0.06), lineWidth: 1)
            )
        }
        .padding(16)
        .background(Color(nsColor: .windowBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(Color.primary.opacity(0.08), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.05), radius: 2, x: 0, y: 1)
    }

    private func toolRow(tool: MCPTool, index: Int) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                Image(systemName: tool.iconName)
                    .font(.title2)
                    .foregroundStyle(tool.iconColor)
                    .frame(width: 32)

                VStack(alignment: .leading, spacing: 2) {
                    Text(tool.name)
                        .font(.subheadline)
                        .fontWeight(.medium)

                    Text(tool.description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }

                Spacer()

                // Show server type badge
                Text(tool.serverType == .http ? "HTTP" : "Local")
                    .font(.caption2)
                    .fontWeight(.medium)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(tool.serverType == .http ? Color.blue.opacity(0.15) : Color.purple.opacity(0.15))
                    .foregroundStyle(tool.serverType == .http ? .blue : .purple)
                    .clipShape(Capsule())

                Toggle("", isOn: Binding(
                    get: { mcpSettings.tools[index].enabled },
                    set: { mcpSettings.tools[index].enabled = $0 }
                ))
                .labelsHidden()
                .toggleStyle(.switch)
                .controlSize(.small)
            }

            // Show endpoint URL for enabled tools
            if mcpSettings.tools[index].enabled {
                let endpointURL = mcpSettings.endpointURL(for: tool)
                if !endpointURL.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "link")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)

                        Text(endpointURL)
                            .font(.system(.caption2, design: .monospaced))
                            .foregroundStyle(.tertiary)
                            .lineLimit(1)
                            .truncationMode(.middle)
                    }
                    .padding(.leading, 44)
                } else if tool.serverType == .stdio {
                    HStack(spacing: 4) {
                        Image(systemName: "terminal")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)

                        Text("npx -y @z_ai/mcp-server")
                            .font(.system(.caption2, design: .monospaced))
                            .foregroundStyle(.tertiary)
                    }
                    .padding(.leading, 44)
                }
            }
        }
        .padding(12)
    }

    // MARK: - Config Mode Section

    private var configModeSection: some View {
        @Bindable var settings = mcpSettings

        return VStack(alignment: .leading, spacing: 12) {
            Label("mcp.configMode.title".localized(), systemImage: "gear")
                .font(.headline)

            Picker("", selection: $settings.configMode) {
                ForEach(MCPConfigMode.allCases) { mode in
                    Text(mode.displayName)
                        .tag(mode)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()

            Text(settings.configMode.description)
                .font(.caption)
                .foregroundStyle(.secondary)

            // Show proxy port when in proxy mode
            if settings.configMode == .proxy {
                VStack(alignment: .leading, spacing: 8) {
                    Text("mcp.proxyPort.title".localized())
                        .font(.subheadline)
                        .fontWeight(.medium)

                    HStack {
                        Text("http://127.0.0.1:")
                            .font(.system(.body, design: .monospaced))
                            .foregroundStyle(.secondary)

                        TextField("8318", value: Binding(
                            get: { Int(settings.mcpPort) },
                            set: { settings.mcpPort = UInt16($0) }
                        ), format: .number)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 80)
                        .font(.system(.body, design: .monospaced))
                    }

                    Text("mcp.proxyPort.hint".localized())
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 8)
            }
        }
        .padding(16)
        .background(Color(nsColor: .windowBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(Color.primary.opacity(0.08), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.05), radius: 2, x: 0, y: 1)
    }

    // MARK: - Status Section

    private var statusSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("mcp.status.title".localized(), systemImage: "antenna.radiowaves.left.and.right")
                    .font(.headline)

                Spacer()

                HStack(spacing: 6) {
                    Circle()
                        .fill(mcpSettings.connectionStatus.color)
                        .frame(width: 8, height: 8)

                    Text(mcpSettings.connectionStatus.displayText)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            if let error = mcpSettings.lastError {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.orange)

                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(10)
                .background(Color.orange.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            if let result = testResult {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: testSuccess ? "checkmark.circle.fill" : "xmark.circle.fill")
                        .foregroundStyle(testSuccess ? .green : .red)

                    Text(result)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(10)
                .background((testSuccess ? Color.green : Color.red).opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            HStack {
                Button {
                    Task {
                        isTesting = true
                        let result = await mcpService.testConnection()
                        testResult = result.message
                        testSuccess = result.success
                        isTesting = false
                    }
                } label: {
                    HStack(spacing: 6) {
                        if isTesting {
                            ProgressView()
                                .controlSize(.small)
                        }
                        Text("mcp.action.testConnection".localized())
                    }
                    .frame(width: 140)
                }
                .disabled(isTesting || !mcpSettings.hasEnabledTools)

                Spacer()

                Text("mcp.enabledTools".localized() + ": \(mcpSettings.enabledTools.count)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .background(Color(nsColor: .windowBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(Color.primary.opacity(0.08), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.05), radius: 2, x: 0, y: 1)
    }

    // MARK: - Footer

    private var footerView: some View {
        HStack {
            Button("mcp.action.reset".localized()) {
                mcpSettings.resetToDefaults()
                testResult = nil
            }
            .buttonStyle(.plain)
            .foregroundStyle(.secondary)

            Spacer()

            Button("action.close".localized()) {
                dismiss()
            }
            .keyboardShortcut(.cancelAction)

            Button {
                Task {
                    isApplying = true
                    do {
                        try await mcpService.applyConfiguration()
                        dismiss()
                    } catch {
                        mcpSettings.lastError = error.localizedDescription
                    }
                    isApplying = false
                }
            } label: {
                HStack(spacing: 6) {
                    if isApplying {
                        ProgressView()
                            .controlSize(.small)
                    }
                    Text("mcp.action.apply".localized())
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isApplying)
            .keyboardShortcut(.defaultAction)
        }
        .padding(20)
    }
}

#Preview {
    MCPConfigSheet()
        .frame(width: 560, height: 580)
}
