import SwiftUI

struct OverviewView: View {
    @EnvironmentObject private var store: AppStore
    @State private var selectedMonthID: UUID?

    var sortedMembers: [Member] {
        store.members
            .filter(\.active)
            .sorted {
                let c0 = store.participationCount(for: $0.id)
                let c1 = store.participationCount(for: $1.id)
                if c0 != c1 { return c0 > c1 } // häufig schießende nach oben
                return $0.lastName.localizedCaseInsensitiveCompare($1.lastName) == .orderedAscending
            }
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    PageHeader(
                        title: "Übersicht",
                        subtitle: "\(store.members.filter(\.active).count) aktive Schützen · \(store.results.count) Ergebnisse",
                        actionTitle: "12 Monate hinzufügen",
                        action: store.appendNext12Months
                    )

                    monthStrip

                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 360), spacing: 14)], spacing: 14) {
                        ForEach(sortedMembers) { member in
                            NavigationLink {
                                MemberDetailView(member: member)
                            } label: {
                                overviewCard(member: member)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(24)
            }
            .liquidPage()
            .onAppear {
                selectedMonthID = store.currentMonthSlotID()
                if let id = selectedMonthID {
                    withAnimation { proxy.scrollTo(id, anchor: .center) }
                }
            }
        }
    }

    private var monthStrip: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(store.monthSlots.sorted(by: { $0.sortIndex < $1.sortIndex })) { slot in
                    Text(slot.label.capitalized)
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10))
                        .background(selectedMonthID == slot.id ? Color.accentColor.opacity(0.20) : Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(AppTheme.line))
                        .id(slot.id)
                        .onTapGesture { selectedMonthID = slot.id }
                }
            }
        }
    }

    private func overviewCard(member: Member) -> some View {
        let count = store.participationCount(for: member.id)
        let pb = store.personalBest(for: member.id)
        let avg = store.average(for: member.id)
        let last = store.latestValue(for: member.id)
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(member.displayName)
                        .font(.headline)
                    if !member.club.isEmpty {
                        Text(member.club)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
            HStack {
                metric("Teilnahmen", "\(count)")
                metric("Bestwert", "\(pb)")
                metric("Durchschnitt", String(format: "%.1f", avg))
                metric("Letzter Wert", "\(last)")
            }
        }
        .appCard()
    }

    private func metric(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            Text(value).font(.subheadline.bold())
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
