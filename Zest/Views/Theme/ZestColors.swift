//
//  ZestColors.swift
//  Zest - AI Quota Manager
//

import SwiftUI

/// Sistema de cores dark minimalista para o Zest
enum ZestColors {

    // MARK: - Backgrounds

    /// Fundo principal - preto profundo
    static let background = Color(hex: "#0D0D0D")

    /// Superfícies elevadas (cards, containers)
    static let surface = Color(hex: "#1A1A1A")

    /// Estado de hover em superfícies
    static let surfaceHover = Color(hex: "#242424")

    /// Bordas sutis
    static let surfaceBorder = Color(hex: "#2D2D2D")

    /// Superfície elevada secundária
    static let surfaceSecondary = Color(hex: "#171717")

    // MARK: - Text

    /// Texto principal - branco off-white
    static let textPrimary = Color(hex: "#F5F5F5")

    /// Texto secundário - cinza médio
    static let textSecondary = Color(hex: "#A3A3A3")

    /// Texto terciário - cinza escuro
    static let textTertiary = Color(hex: "#666666")

    // MARK: - Accent Colors

    /// Verde - Success/Running
    static let accentGreen = Color(hex: "#22C55E")

    /// Azul - Primary actions
    static let accentBlue = Color(hex: "#3B82F6")

    /// Laranja - Warning
    static let accentOrange = Color(hex: "#F97316")

    /// Vermelho - Error/Stopped
    static let accentRed = Color(hex: "#EF4444")

    /// Roxo - Pro/Premium features
    static let accentPurple = Color(hex: "#A855F7")

    /// Cyan - Info/Secondary action
    static let accentCyan = Color(hex: "#06B6D4")

    // MARK: - Gradients

    /// Gradiente primário para botões especiais
    static let primaryGradient = LinearGradient(
        colors: [Color(hex: "#3B82F6"), Color(hex: "#8B5CF6")],
        startPoint: .leading,
        endPoint: .trailing
    )

    /// Gradiente de sucesso
    static let successGradient = LinearGradient(
        colors: [Color(hex: "#22C55E"), Color(hex: "#10B981")],
        startPoint: .leading,
        endPoint: .trailing
    )

    /// Gradiente para status running com brilho
    static let runningGradient = LinearGradient(
        colors: [Color(hex: "#22C55E").opacity(0.8), Color(hex: "#16A34A")],
        startPoint: .top,
        endPoint: .bottom
    )

    // MARK: - Semantic Colors

    /// Cor de status baseada no estado de execução
    static func statusColor(isRunning: Bool) -> Color {
        isRunning ? accentGreen : textTertiary
    }

    /// Cor de borda para estados interativos
    static func borderColor(isHovered: Bool, accent: Color = accentBlue) -> Color {
        isHovered ? accent.opacity(0.5) : surfaceBorder
    }
}

// MARK: - View Modifiers for Dark Theme

extension View {
    /// Aplica o estilo de card dark
    func zestCard(isHovered: Bool = false) -> some View {
        self
            .padding(16)
            .background(ZestColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(
                        isHovered ? ZestColors.accentBlue.opacity(0.3) : ZestColors.surfaceBorder,
                        lineWidth: 0.5
                    )
            )
            .shadow(color: .black.opacity(0.2), radius: 8, y: 4)
    }

    /// Aplica fundo dark ao container principal
    func zestBackground() -> some View {
        self.background(ZestColors.background)
    }

    /// Estilo de superfície elevada
    func zestSurface() -> some View {
        self
            .background(ZestColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
