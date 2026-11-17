import SwiftUI
import Charts

private enum DetailPeriod: String, CaseIterable, Identifiable {
    case all
    case month
    case range
    var id: String { rawValue }
    var label: String {
        switch self {
        case .all: return "All Time"
        case .month: return "Monat"
        case .range: return "Benutzerdefiniert"
        }
    }
}

struct MemberDetailView: View {
    @EnvironmentObject private var store: AppStore
    let member: Member

    @State private var period: DetailPeriod = .all
    @State private var selectedMonthID: UUID?
    @State private var fromSlotID: UUID?
    @State private var toSlotID: UUID?

    var filteredPoints: [TimelinePoint] {
        let points = store.bestTimeline(for: member.id)
        switch period {
        case .all:
            return points
        case .month:
            guard let selectedMonthID,
                  let slot = store.monthSlots.first(where: { $0.id == selectedMonthID }) else { return [] }
            return points.filter { $0.date >= slot.startDate && $0.date <= slot.endDate }
        case .range:
            guard
                let from = store.monthSlots.first(where: { $0.id == fromSlotID }),
                let to = store.monthSlots.first(where: { $0.id == toSlotID })
            else { return [] }
            let start = min(from.startDate, to.startDate)
            let end = max(from.endDate, to.endDate)
            return points.filter { $0.date >= start && $0.date <= end }
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                PageHeader(
                    title: member.displayName,
                    subtitle: member.club.isEmpty ? "Persönliche Auswertung" : member.club
                )
                periodControl

                stats

                chartCard(title: "Gesamtergebnis") {
                    Chart(filteredPoints) { p in
                        LineMark(x: .value("X", p.date), y: .value("Y", p.overall))
                            .interpolationMethod(.monotone)
                        PointMark(x: .value("X", p.date), y: .value("Y", p.overall))
                    }
                    .chartXAxisLabel("Datum/Monat")
                    .chartYAxisLabel("Punkte")
                    .frame(height: 220)
                }

                chartCard(title: "Nur Ringe") {
                    Chart(filteredPoints) { p in
                        LineMark(x: .value("X", p.date), y: .value("Y", p.rings))
                            .foregroundStyle(.green)
                    }
                    .chartXAxisLabel("Datum/Monat")
                    .chartYAxisLabel("Ringe")
                    .frame(height: 220)
                }

                chartCard(title: "Nur Zeit") {
                    Chart(filteredPoints.filter { $0.time != nil }) { p in
                        LineMark(x: .value("X", p.date), y: .value("Y", p.time ?? 0))
                            .foregroundStyle(.orange)
                    }
                    .chartXAxisLabel("Datum/Monat")
                    .chartYAxisLabel("Sekunden")
                    .frame(height: 220)
                }
            }
            .padding(24)
        }
        .liquidPage()
        .onAppear {
            selectedMonthID = selectedMonthID ?? store.currentMonthSlotID()
            fromSlotID = fromSlotID ?? store.monthSlots.first?.id
            toSlotID = toSlotID ?? store.monthSlots.last?.id
        }
    }

    private var stats: some View {
        HStack {
            MetricTile(title: "PB", value: "\(store.personalBest(for: member.id))", tint: .green)
            MetricTile(title: "Durchschnitt", value: String(format: "%.1f", store.average(for: member.id)), tint: .blue)
            MetricTile(title: "Letzter Wert", value: "\(store.latestValue(for: member.id))", tint: .orange)
            MetricTile(title: "Teilnahmen", value: "\(store.participationCount(for: member.id))", tint: .purple)
        }
    }

    private var periodControl: some View {
        VStack(alignment: .leading) {
            Picker("Zeitraum", selection: $period) {
                ForEach(DetailPeriod.allCases) { p in Text(p.label).tag(p) }
            }
            .pickerStyle(.segmented)

            if period == .month {
                monthPicker("Monat", selection: $selectedMonthID)
            }
            if period == .range {
                HStack {
                    monthPicker("Von", selection: $fromSlotID)
                    monthPicker("Bis", selection: $toSlotID)
                }
            }
        }
        .appCard()
    }

    private func monthPicker(_ title: String, selection: Binding<UUID?>) -> some View {
        Picker(title, selection: selection) {
            ForEach(store.monthSlots.sorted(by: { $0.sortIndex < $1.sortIndex })) { slot in
                Text(slot.label.capitalized).tag(Optional(slot.id))
            }
        }
        .pickerStyle(.menu)
    }

    private func chartCard<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.headline)
            content()
        }
        .appCard()
    }
}
