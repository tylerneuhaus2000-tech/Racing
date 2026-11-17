import SwiftUI

enum AppSection: String, CaseIterable, Identifiable {
    case overview
    case entry
    case members
    case ranking
    case rules

    var id: String { rawValue }
    var title: String {
        switch self {
        case .overview: return "Übersicht"
        case .entry: return "Eintragen"
        case .members: return "Mitgliederliste"
        case .ranking: return "Rangliste"
        case .rules: return "Regelwerk"
        }
    }

    var icon: String {
        switch self {
        case .overview: return "rectangle.grid.2x2.fill"
        case .entry: return "square.and.pencil"
        case .members: return "person.3.fill"
        case .ranking: return "list.number"
        case .rules: return "book.closed.fill"
        }
    }
}

struct RootView: View {
    @State private var selection: AppSection? = .overview

    var body: some View {
        NavigationSplitView {
            List(AppSection.allCases, selection: $selection) { item in
                Label(item.title, systemImage: item.icon)
                    .tag(item)
            }
            .navigationTitle("Mehrdistanz")
            .frame(minWidth: 210)
        } detail: {
            switch selection ?? .overview {
            case .overview:
                OverviewView()
            case .entry:
                EntryView()
            case .members:
                MembersView()
            case .ranking:
                RankingView()
            case .rules:
                RulesView()
            }
        }
        .frame(minWidth: 1050, minHeight: 720)
    }
}
