//
//  ZestCard.swift
//  Zest - AI Quota Manager
//

import SwiftUI

/// Card dark moderno com bordas sutis e sombra
struct ZestCard<Content: View>: View {
    let content: Content
    var isHoverable: Bool = false
    @State private var isHovered = false

    init(isHoverable: Bool = false, @ViewBuilder content: () -> Content) {
        self.isHoverable = isHoverable
        self.content = content()
    }

    var body: some View {
        content
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
            .scaleEffect(isHoverable && isHovered ? 1.02 : 1.0)
            .animation(ZestAnimations.snap, value: isHovered)
            .onHover { hovering in
                if isHoverable {
                    isHovered = hovering
                }
            }
    }
}

/// Card com cabeçalho e conteúdo separados
struct ZestCardWithHeader<Header: View, Content: View>: View {
    let header: Header
    let content: Content
    @State private var isHovered = false

    init(
        @ViewBuilder header: () -> Header,
        @ViewBuilder content: () -> Content
    ) {
        self.header = header()
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(ZestColors.surfaceSecondary)

            Divider()
                .background(ZestColors.surfaceBorder)

            content
                .padding(16)
        }
        .background(ZestColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(ZestColors.surfaceBorder, lineWidth: 0.5)
        )
        .shadow(color: .black.opacity(0.15), radius: 6, y: 3)
    }
}

/// Card de estatística/KPI com ícone e valor
struct ZestStatCard: View {
    let icon: String
    let title: String
    let value: String
    let subtitle: String?
    let accentColor: Color
    let index: Int

    @State private var isHovered = false

    init(
        icon: String,
        title: String,
        value: String,
        subtitle: String? = nil,
        accentColor: Color = ZestColors.accentBlue,
        index: Int = 0
    ) {
        self.icon = icon
        self.title = title
        self.value = value
        self.subtitle = subtitle
        self.accentColor = accentColor
        self.index = index
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                // Icon with accent background
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(accentColor.opacity(0.15))
                        .frame(width: 36, height: 36)

                    Image(systemName: icon)
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(accentColor)
                }

                Spacer()

                // Optional trend indicator
                if let sub = subtitle {
                    Text(sub)
                        .font(.caption)
                        .foregroundStyle(ZestColors.textTertiary)
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.caption)
                    .foregroundStyle(ZestColors.textSecondary)

                Text(value)
                    .font(.title2.weight(.bold))
                    .foregroundStyle(ZestColors.textPrimary)
            }
        }
        .padding(16)
        .background(ZestColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(
                    isHovered ? accentColor.opacity(0.3) : ZestColors.surfaceBorder,
                    lineWidth: 0.5
                )
        )
        .shadow(color: .black.opacity(0.15), radius: 6, y: 3)
        .scaleEffect(isHovered ? 1.03 : 1.0)
        .animation(ZestAnimations.snap, value: isHovered)
        .onHover { isHovered = $0 }
        .staggeredAppear(index: index, baseDelay: 0.08)
    }
}

// MARK: - Preview

#Preview("ZestCard") {
    VStack(spacing: 20) {
        ZestCard {
            VStack(alignment: .leading) {
                Text("Simple Card")
                    .font(.headline)
                    .foregroundStyle(ZestColors.textPrimary)
                Text("Card content goes here")
                    .font(.subheadline)
                    .foregroundStyle(ZestColors.textSecondary)
            }
        }

        ZestStatCard(
            icon: "chart.bar.fill",
            title: "Total Requests",
            value: "1,234",
            subtitle: "+12%",
            accentColor: ZestColors.accentGreen,
            index: 0
        )
    }
    .padding()
    .background(ZestColors.background)
}
