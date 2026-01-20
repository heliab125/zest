//
//  CurrentModeBadge.swift
//  Zest - AI Quota Manager
//
//  Compact badge showing current operating mode in sidebar footer
//

import SwiftUI

/// Compact badge showing current mode in sidebar, clickable to open settings
struct CurrentModeBadge: View {
    @Environment(QuotaViewModel.self) private var viewModel
    private var modeManager = OperatingModeManager.shared
    @State private var isHovered = false

    var body: some View {
        Button {
            viewModel.currentPage = .settings
        } label: {
            HStack(spacing: 8) {
                // Mode icon
                Image(systemName: modeManager.currentMode.icon)
                    .font(.caption)
                    .foregroundStyle(modeManager.currentMode.color)

                // Mode name
                VStack(alignment: .leading, spacing: 1) {
                    Text(modeName)
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundStyle(ZestColors.textPrimary)
                        .lineLimit(1)

                    // Status subtitle
                    Text(statusText)
                        .font(.caption2)
                        .foregroundStyle(ZestColors.textSecondary)
                        .lineLimit(1)
                }

                Spacer()

                // Chevron indicator
                Image(systemName: "chevron.right")
                    .font(.caption2)
                    .foregroundStyle(ZestColors.textTertiary)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(backgroundView)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(borderColor, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
        .help("sidebar.modeBadge.hint".localized())
        .animation(ZestAnimations.hover, value: isHovered)
    }

    private var modeName: String {
        switch modeManager.currentMode {
        case .monitor:
            return "mode.monitor".localized()
        case .localProxy:
            return "mode.localProxy".localized()
        case .remoteProxy:
            return "mode.remoteProxy".localized()
        }
    }

    private var statusText: String {
        switch modeManager.currentMode {
        case .monitor:
            let count = viewModel.directAuthFiles.count
            return String(format: "sidebar.modeBadge.accounts".localized(), count)
        case .localProxy:
            if viewModel.proxyManager.proxyStatus.running {
                return ":" + String(viewModel.proxyManager.port) + " - " + "status.running".localized()
            } else {
                return "status.stopped".localized()
            }
        case .remoteProxy:
            switch modeManager.connectionStatus {
            case .connected:
                return "status.connected".localized()
            case .connecting:
                return "status.connecting".localized()
            case .disconnected:
                return "status.disconnected".localized()
            case .error:
                return "status.error".localized()
            }
        }
    }

    @ViewBuilder
    private var backgroundView: some View {
        if isHovered {
            modeManager.currentMode.color.opacity(0.1)
        } else {
            ZestColors.surfaceSecondary
        }
    }

    private var borderColor: Color {
        if isHovered {
            return modeManager.currentMode.color.opacity(0.4)
        } else {
            return ZestColors.surfaceBorder
        }
    }
}

#Preview {
    CurrentModeBadge()
        .environment(QuotaViewModel())
        .padding()
        .frame(width: 200)
        .background(ZestColors.background)
}
