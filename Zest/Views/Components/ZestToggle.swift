//
//  ZestToggle.swift
//  Zest - AI Quota Manager
//

import SwiftUI

/// Toggle animado com estilo dark moderno
struct ZestToggle: View {
    @Binding var isOn: Bool
    var onColor: Color = ZestColors.accentGreen
    var offColor: Color = ZestColors.textTertiary

    var body: some View {
        Button {
            withAnimation(ZestAnimations.bounce) {
                isOn.toggle()
            }
        } label: {
            ZStack(alignment: isOn ? .trailing : .leading) {
                // Track
                Capsule()
                    .fill(isOn ? onColor : offColor.opacity(0.3))
                    .frame(width: 44, height: 26)
                    .overlay(
                        Capsule()
                            .stroke(
                                isOn ? onColor.opacity(0.3) : ZestColors.surfaceBorder,
                                lineWidth: 1
                            )
                    )

                // Thumb
                Circle()
                    .fill(.white)
                    .frame(width: 22, height: 22)
                    .padding(2)
                    .shadow(color: .black.opacity(0.2), radius: 2, y: 1)
            }
        }
        .buttonStyle(.plain)
    }
}

/// Toggle com label integrado
struct ZestLabeledToggle: View {
    let label: String
    let description: String?
    @Binding var isOn: Bool
    var onColor: Color = ZestColors.accentGreen

    @State private var isHovered = false

    init(
        _ label: String,
        description: String? = nil,
        isOn: Binding<Bool>,
        onColor: Color = ZestColors.accentGreen
    ) {
        self.label = label
        self.description = description
        self._isOn = isOn
        self.onColor = onColor
    }

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.body)
                    .foregroundStyle(ZestColors.textPrimary)

                if let desc = description {
                    Text(desc)
                        .font(.caption)
                        .foregroundStyle(ZestColors.textSecondary)
                }
            }

            Spacer()

            ZestToggle(isOn: $isOn, onColor: onColor)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(isHovered ? ZestColors.surfaceHover : .clear)
        )
        .onHover { isHovered = $0 }
        .animation(ZestAnimations.hover, value: isHovered)
    }
}

// MARK: - ZestSegmentedPicker

/// Picker segmentado com indicador deslizante animado
struct ZestSegmentedPicker<T: Hashable>: View {
    @Binding var selection: T
    let options: [T]
    let label: (T) -> String

    @Namespace private var namespace

    var body: some View {
        HStack(spacing: 0) {
            ForEach(options, id: \.self) { option in
                Button {
                    withAnimation(ZestAnimations.snap) {
                        selection = option
                    }
                } label: {
                    Text(label(option))
                        .font(.subheadline.weight(selection == option ? .semibold : .regular))
                        .foregroundStyle(selection == option ? .white : ZestColors.textSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(
                            Group {
                                if selection == option {
                                    RoundedRectangle(cornerRadius: 8)
                                        .fill(ZestColors.accentBlue)
                                        .matchedGeometryEffect(id: "segment", in: namespace)
                                }
                            }
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(ZestColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(ZestColors.surfaceBorder, lineWidth: 0.5)
        )
    }
}

/// Picker segmentado com ícones
struct ZestIconSegmentedPicker<T: Hashable>: View {
    @Binding var selection: T
    let options: [(value: T, icon: String, label: String)]

    @Namespace private var namespace
    @State private var hoveredOption: T?

    var body: some View {
        HStack(spacing: 2) {
            ForEach(options, id: \.value) { option in
                Button {
                    withAnimation(ZestAnimations.snap) {
                        selection = option.value
                    }
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: option.icon)
                            .font(.system(size: 16, weight: .medium))

                        Text(option.label)
                            .font(.caption2)
                    }
                    .foregroundStyle(
                        selection == option.value
                            ? .white
                            : (hoveredOption == option.value ? ZestColors.textPrimary : ZestColors.textSecondary)
                    )
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(
                        Group {
                            if selection == option.value {
                                RoundedRectangle(cornerRadius: 10)
                                    .fill(ZestColors.accentBlue)
                                    .matchedGeometryEffect(id: "iconSegment", in: namespace)
                            } else if hoveredOption == option.value {
                                RoundedRectangle(cornerRadius: 10)
                                    .fill(ZestColors.surfaceHover)
                            }
                        }
                    )
                }
                .buttonStyle(.plain)
                .onHover { hovering in
                    hoveredOption = hovering ? option.value : nil
                }
            }
        }
        .padding(4)
        .background(ZestColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(ZestColors.surfaceBorder, lineWidth: 0.5)
        )
        .animation(ZestAnimations.hover, value: hoveredOption)
    }
}

// MARK: - Preview

#Preview("ZestToggle") {
    VStack(spacing: 20) {
        ZestToggle(isOn: .constant(true))
        ZestToggle(isOn: .constant(false))

        ZestLabeledToggle(
            "Auto-start proxy",
            description: "Start proxy when app launches",
            isOn: .constant(true)
        )

        ZestSegmentedPicker(
            selection: .constant("All"),
            options: ["All", "Active", "Inactive"],
            label: { $0 }
        )
        .frame(width: 300)
    }
    .padding()
    .background(ZestColors.background)
}
