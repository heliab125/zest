//
//  ZestAnimations.swift
//  Zest - AI Quota Manager
//

import SwiftUI

/// Sistema de animações vivas com springs e bounces para o Zest
enum ZestAnimations {

    // MARK: - Spring Animations

    /// Bounce expressivo - para aparições e interações
    static let bounce = Animation.spring(response: 0.4, dampingFraction: 0.6, blendDuration: 0)

    /// Snap rápido - para transições de estado
    static let snap = Animation.spring(response: 0.3, dampingFraction: 0.7, blendDuration: 0)

    /// Gentle suave - para transições maiores
    static let gentle = Animation.spring(response: 0.5, dampingFraction: 0.8, blendDuration: 0)

    /// Para transições de página/tela
    static let pageTransition = Animation.spring(response: 0.35, dampingFraction: 0.85)

    /// Para elementos pequenos (toggles, badges)
    static let micro = Animation.spring(response: 0.25, dampingFraction: 0.75)

    /// Para hover states
    static let hover = Animation.spring(response: 0.2, dampingFraction: 0.8)

    // MARK: - Easing Animations

    /// Transição suave padrão
    static let smooth = Animation.easeInOut(duration: 0.25)

    /// Para progress bars
    static let progress = Animation.easeOut(duration: 0.3)
}

// MARK: - View Modifiers

/// Faz a view aparecer com bounce quando entra na tela
struct BounceOnAppear: ViewModifier {
    @State private var appeared = false

    func body(content: Content) -> some View {
        content
            .scaleEffect(appeared ? 1 : 0.8)
            .opacity(appeared ? 1 : 0)
            .onAppear {
                withAnimation(ZestAnimations.bounce) {
                    appeared = true
                }
            }
    }
}

/// Faz a view deslizar de baixo com fade
struct SlideFromBottom: ViewModifier {
    @State private var appeared = false
    let delay: Double

    init(delay: Double = 0) {
        self.delay = delay
    }

    func body(content: Content) -> some View {
        content
            .offset(y: appeared ? 0 : 20)
            .opacity(appeared ? 1 : 0)
            .onAppear {
                withAnimation(ZestAnimations.gentle.delay(delay)) {
                    appeared = true
                }
            }
    }
}

/// Faz a view deslizar da esquerda
struct SlideFromLeading: ViewModifier {
    @State private var appeared = false
    let delay: Double

    init(delay: Double = 0) {
        self.delay = delay
    }

    func body(content: Content) -> some View {
        content
            .offset(x: appeared ? 0 : -20)
            .opacity(appeared ? 1 : 0)
            .onAppear {
                withAnimation(ZestAnimations.gentle.delay(delay)) {
                    appeared = true
                }
            }
    }
}

/// Animação de pulso contínuo para elementos ativos
struct PulseAnimation: ViewModifier {
    @State private var isPulsing = false
    let isActive: Bool

    init(isActive: Bool = true) {
        self.isActive = isActive
    }

    func body(content: Content) -> some View {
        content
            .scaleEffect(isPulsing && isActive ? 1.05 : 1.0)
            .animation(
                isActive
                    ? .easeInOut(duration: 1.2).repeatForever(autoreverses: true)
                    : .default,
                value: isPulsing
            )
            .onAppear {
                isPulsing = true
            }
            .onChange(of: isActive) { _, newValue in
                if !newValue {
                    isPulsing = false
                }
            }
    }
}

/// Efeito de glow pulsante para status running
struct GlowPulse: ViewModifier {
    @State private var isGlowing = false
    let color: Color
    let isActive: Bool

    init(color: Color = ZestColors.accentGreen, isActive: Bool = true) {
        self.color = color
        self.isActive = isActive
    }

    func body(content: Content) -> some View {
        content
            .shadow(
                color: isActive ? color.opacity(isGlowing ? 0.6 : 0.2) : .clear,
                radius: isGlowing ? 10 : 5
            )
            .animation(
                isActive
                    ? .easeInOut(duration: 1.0).repeatForever(autoreverses: true)
                    : .default,
                value: isGlowing
            )
            .onAppear {
                if isActive {
                    isGlowing = true
                }
            }
            .onChange(of: isActive) { _, newValue in
                isGlowing = newValue
            }
    }
}

/// Animação de escala para botões pressionados
struct PressableScale: ViewModifier {
    @State private var isPressed = false

    func body(content: Content) -> some View {
        content
            .scaleEffect(isPressed ? 0.95 : 1.0)
            .animation(ZestAnimations.micro, value: isPressed)
            .simultaneousGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in isPressed = true }
                    .onEnded { _ in isPressed = false }
            )
    }
}

/// Aparição sequencial para listas
struct StaggeredAppear: ViewModifier {
    @State private var appeared = false
    let index: Int
    let baseDelay: Double

    init(index: Int, baseDelay: Double = 0.05) {
        self.index = index
        self.baseDelay = baseDelay
    }

    func body(content: Content) -> some View {
        content
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 15)
            .onAppear {
                withAnimation(ZestAnimations.gentle.delay(Double(index) * baseDelay)) {
                    appeared = true
                }
            }
    }
}

/// Indicador deslizante para tab pickers
struct SlidingIndicator: ViewModifier {
    let isSelected: Bool
    @Namespace private var namespace

    func body(content: Content) -> some View {
        content
            .background(
                Group {
                    if isSelected {
                        RoundedRectangle(cornerRadius: 8)
                            .fill(ZestColors.accentBlue)
                            .matchedGeometryEffect(id: "indicator", in: namespace)
                    }
                }
            )
    }
}

// MARK: - View Extensions

extension View {
    /// Aparece com bounce animado
    func bounceOnAppear() -> some View {
        modifier(BounceOnAppear())
    }

    /// Desliza de baixo com delay opcional
    func slideFromBottom(delay: Double = 0) -> some View {
        modifier(SlideFromBottom(delay: delay))
    }

    /// Desliza da esquerda com delay opcional
    func slideFromLeading(delay: Double = 0) -> some View {
        modifier(SlideFromLeading(delay: delay))
    }

    /// Pulsa continuamente quando ativo
    func pulseAnimation(isActive: Bool = true) -> some View {
        modifier(PulseAnimation(isActive: isActive))
    }

    /// Glow pulsante para status
    func glowPulse(color: Color = ZestColors.accentGreen, isActive: Bool = true) -> some View {
        modifier(GlowPulse(color: color, isActive: isActive))
    }

    /// Escala ao pressionar
    func pressableScale() -> some View {
        modifier(PressableScale())
    }

    /// Aparição escalonada para itens de lista
    func staggeredAppear(index: Int, baseDelay: Double = 0.05) -> some View {
        modifier(StaggeredAppear(index: index, baseDelay: baseDelay))
    }

    /// Transição suave com spring para mudanças de estado
    func springTransition<Value: Equatable>(_ value: Value) -> some View {
        self.animation(ZestAnimations.snap, value: value)
    }
}

// MARK: - Transition Extensions

extension AnyTransition {
    /// Transição de slide com fade do lado
    static var slideFromSide: AnyTransition {
        .asymmetric(
            insertion: .move(edge: .trailing).combined(with: .opacity),
            removal: .move(edge: .leading).combined(with: .opacity)
        )
    }

    /// Transição de scale com fade
    static var scaleWithFade: AnyTransition {
        .scale(scale: 0.9).combined(with: .opacity)
    }

    /// Transição de slide de baixo
    static var slideUp: AnyTransition {
        .move(edge: .bottom).combined(with: .opacity)
    }
}
