import SwiftUI

private enum RankingMode: String, CaseIterable, Identifiable {
    case all
    case month
    case custom
    var id: String { rawValue }
    var label: String {
        switch self {
        case .all: return "All Time"
        case .month: return "Monat"
        case .custom: return "Benutzerdefiniert"
        }
    }
}

struct RankingView: View {
    @EnvironmentObject private var store: AppStore
    @State private var mode: RankingMode = .all
    @State private var fromSlotID: UUID?
    @State private var toSlotID: UUID?
    @State private var selectedSlotID: UUID?

    var ranking: [(member: Member, score: Int)] {
        let active = store.members.filter(\.active)
        return active
            .map { m in
                let score: Int
                switch mode {
                case .all:
                    score = store.personalBest(for: m.id)
                case .month:
                    guard let selectedSlotID else { return (m, 0) }
                    score = store.monthBest(for: m.id, monthSlotID: selectedSlotID) ?? 0
                case .custom:
                    score = bestInRange(memberID: m.id)
                }
                return (m, score)
            }
            .filter { $0.score > 0 }
            .sorted { $0.score > $1.score }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            PageHeader(
                title: "Rangliste",
                subtitle: ranking.isEmpty ? "Keine Ergebnisse im gewählten Zeitraum" : "\(ranking.count) Platzierungen im aktuellen Filter"
            )

            Picker("Modus", selection: $mode) {
                ForEach(RankingMode.allCases) { m in
                    Text(m.label).tag(m)
                }
            }
            .pickerStyle(.segmented)

            if mode == .month {
                monthDropdown("Monat", selection: $selectedSlotID)
            } else if mode == .custom {
                HStack {
                    monthDropdown("Von", selection: $fromSlotID)
                    monthDropdown("Bis", selection: $toSlotID)
                }
            }

            ScrollView {
                LazyVStack(spacing: 10) {
                    ForEach(Array(ranking.enumerated()), id: \.element.member.id) { idx, row in
                        HStack(spacing: 14) {
                            Text("\(idx + 1)")
                                .font(.system(.title3, design: .rounded, weight: .bold))
                                .monospacedDigit()
                                .frame(width: 42, height: 42)
                                .background(rankTint(idx).opacity(0.14), in: Circle())
                                .foregroundStyle(rankTint(idx))
                            VStack(alignment: .leading, spacing: 3) {
                                Text(row.member.displayName).font(.headline)
                                Text("Bestwert im Zeitraum").font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text("\(row.score)")
                                .font(.system(.title2, design: .rounded, weight: .bold))
                                .monospacedDigit()
                        }
                        .appCard()
                    }
                }
            }
        }
        .padding(24)
        .liquidPage()
        .onAppear {
            selectedSlotID = selectedSlotID ?? store.currentMonthSlotID()
            fromSlotID = fromSlotID ?? store.monthSlots.first?.id
            toSlotID = toSlotID ?? store.monthSlots.last?.id
        }
    }

    private func monthDropdown(_ title: String, selection: Binding<UUID?>) -> some View {
        Picker(title, selection: selection) {
            ForEach(store.monthSlots.sorted(by: { $0.sortIndex < $1.sortIndex })) { slot in
                Text(slot.label.capitalized).tag(Optional(slot.id))
            }
        }
        .pickerStyle(.menu)
    }

    private func bestInRange(memberID: UUID) -> Int {
        guard
            let from = store.monthSlots.first(where: { $0.id == fromSlotID })?.sortIndex,
            let to = store.monthSlots.first(where: { $0.id == toSlotID })?.sortIndex
        else { return 0 }
        let low = min(from, to)
        let high = max(from, to)
        let vals = store.results
            .filter { $0.memberId == memberID && $0.status == .gueltig }
            .filter { r in
                guard let idx = store.monthSlots.first(where: { $0.id == r.monthSlotId })?.sortIndex else { return false }
                return idx >= low && idx <= high
            }
            .map { store.computed(for: $0).overallTotal }
        return vals.max() ?? 0
    }

    private func rankTint(_ index: Int) -> Color {
        switch index {
        case 0: return .yellow
        case 1: return .gray
        case 2: return .orange
        default: return .accentColor
        }
    }
}
