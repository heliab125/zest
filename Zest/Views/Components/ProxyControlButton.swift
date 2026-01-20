//
//  ProxyControlButton.swift
//  Zest - AI Quota Manager
//

import SwiftUI

/// Botão grande e proeminente para controle do proxy
/// Posicionado na sidebar footer para fácil acesso
struct ProxyControlButton: View {
    let viewModel: QuotaViewModel
    @State private var isHovered = false

    private var isRunning: Bool {
        viewModel.proxyManager.proxyStatus.running
    }

    private var isStarting: Bool {
        viewModel.proxyManager.isStarting
    }

    private var statusColor: Color {
        if isStarting {
            return ZestColors.accentOrange
        }
        return isRunning ? ZestColors.accentGreen : ZestColors.textTertiary
    }

    private var statusText: String {
        if isStarting {
            return "status.starting".localized()
        }
        return isRunning ? "action.stopProxy".localized() : "action.startProxy".localized()
    }

    private var subtitleText: String {
        if isStarting {
            return "status.pleaseWait".localized()
        }
        return isRunning
            ? ":\(viewModel.proxyManager.port)"
            : "status.clickToStart".localized()
    }

    var body: some View {
        Button {
            Task { await viewModel.toggleProxy() }
        } label: {
            HStack(spacing: 12) {
                // Ícone com animação de pulso quando running
                ZStack {
                    // Background circle
                    Circle()
                        .fill(statusColor.opacity(0.15))
                        .frame(width: 40, height: 40)

                    // Glow ring when running
                    if isRunning {
                        Circle()
                            .stroke(statusColor.opacity(0.3), lineWidth: 2)
                            .frame(width: 40, height: 40)
                            .glowPulse(color: statusColor, isActive: isRunning)
                    }

                    // Icon
                    Group {
                        if isStarting {
                            ProgressView()
                                .scaleEffect(0.7)
                                .tint(statusColor)
                        } else {
                            Image(systemName: isRunning ? "stop.fill" : "play.fill")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(statusColor)
                        }
                    }
                }
                .pulseAnimation(isActive: isRunning && !isStarting)

                VStack(alignment: .leading, spacing: 2) {
                    Text(statusText)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(ZestColors.textPrimary)

                    Text(subtitleText)
                        .font(.caption)
                        .foregroundStyle(ZestColors.textSecondary)
                }

                Spacer()

                // Status indicator dot
                Circle()
                    .fill(statusColor)
                    .frame(width: 8, height: 8)
                    .glowPulse(color: statusColor, isActive: isRunning)
            }
            .padding(12)
            .background(ZestColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(
                        isHovered ? statusColor.opacity(0.4) : ZestColors.surfaceBorder,
                        lineWidth: 1
                    )
            )
            .shadow(
                color: isRunning ? statusColor.opacity(0.1) : .clear,
                radius: 8,
                y: 2
            )
        }
        .buttonStyle(.plain)
        .scaleEffect(isHovered ? 1.02 : 1.0)
        .animation(ZestAnimations.snap, value: isHovered)
        .animation(ZestAnimations.snap, value: isRunning)
        .animation(ZestAnimations.snap, value: isStarting)
        .onHover { isHovered = $0 }
        .disabled(isStarting)
    }
}

// MARK: - Compact Variant

/// Versão compacta do botão de controle do proxy para espaços menores
struct ProxyControlButtonCompact: View {
    let viewModel: QuotaViewModel
    @State private var isHovered = false

    private var isRunning: Bool {
        viewModel.proxyManager.proxyStatus.running
    }

    private var statusColor: Color {
        isRunning ? ZestColors.accentGreen : ZestColors.textTertiary
    }

    var body: some View {
        Button {
            Task { await viewModel.toggleProxy() }
        } label: {
            HStack(spacing: 8) {
                Circle()
                    .fill(statusColor)
                    .frame(width: 8, height: 8)
                    .glowPulse(color: statusColor, isActive: isRunning)

                if viewModel.proxyManager.isStarting {
                    ProgressView()
                        .scaleEffect(0.6)
                } else {
                    Image(systemName: isRunning ? "stop.fill" : "play.fill")
                        .font(.caption)
                        .foregroundStyle(statusColor)
                }

                Text(isRunning ? "status.running".localized() : "status.stopped".localized())
                    .font(.caption)
                    .foregroundStyle(ZestColors.textSecondary)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(ZestColors.surface)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(ZestColors.surfaceBorder, lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
        .scaleEffect(isHovered ? 1.05 : 1.0)
        .animation(ZestAnimations.micro, value: isHovered)
        .onHover { isHovered = $0 }
    }
}
