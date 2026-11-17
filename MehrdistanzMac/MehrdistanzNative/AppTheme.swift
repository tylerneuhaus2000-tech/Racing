import SwiftUI

enum AppTheme {
    static let page = LinearGradient(
        colors: [
            Color(nsColor: .windowBackgroundColor),
            Color.accentColor.opacity(0.08),
            Color(nsColor: .windowBackgroundColor)
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
    static let panel = Color(nsColor: .controlBackgroundColor).opacity(0.42)
    static let soft = Color.accentColor.opacity(0.10)
    static let line = Color.white.opacity(0.30)
    static let innerLine = Color.primary.opacity(0.08)
}

struct PageHeader: View {
    let title: String
    let subtitle: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.system(size: 32, weight: .bold, design: .rounded))
                Text(subtitle)
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(.borderedProminent)
            }
        }
        .padding(.bottom, 6)
    }
}

struct MetricTile: View {
    let title: String
    let value: String
    var tint: Color = .accentColor

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.system(.title3, design: .rounded, weight: .bold))
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10))
        .background(tint.opacity(0.10), in: RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(.linearGradient(colors: [.white.opacity(0.55), tint.opacity(0.18), .clear], startPoint: .topLeading, endPoint: .bottomTrailing), lineWidth: 1)
        )
        .shadow(color: tint.opacity(0.10), radius: 12, x: 0, y: 8)
    }
}

extension View {
    func appCard() -> some View {
        self
            .padding(16)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
            .background(AppTheme.panel, in: RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(.linearGradient(colors: [AppTheme.line, AppTheme.innerLine, .clear], startPoint: .topLeading, endPoint: .bottomTrailing), lineWidth: 1)
            )
            .overlay(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: 12)
                    .fill(.white.opacity(0.13))
                    .frame(height: 1)
                    .padding(.horizontal, 12)
                    .padding(.top, 1)
            }
            .shadow(color: .black.opacity(0.08), radius: 18, x: 0, y: 10)
    }

    func liquidPage() -> some View {
        self
            .background(AppTheme.page)
    }
}
