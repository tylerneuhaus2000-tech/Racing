import SwiftUI

struct MembersView: View {
    @EnvironmentObject private var store: AppStore
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var club = ""
    @State private var notes = ""
    @State private var editID: UUID?
    @State private var searchText = ""

    private var visibleMembers: [Member] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        return store.members
            .filter { member in
                guard !query.isEmpty else { return true }
                return member.firstName.localizedCaseInsensitiveContains(query)
                    || member.lastName.localizedCaseInsensitiveContains(query)
                    || member.displayName.localizedCaseInsensitiveContains(query)
            }
            .sorted { lhs, rhs in
                let last = lhs.lastName.localizedCaseInsensitiveCompare(rhs.lastName)
                if last != .orderedSame { return last == .orderedAscending }
                let first = lhs.firstName.localizedCaseInsensitiveCompare(rhs.firstName)
                if first != .orderedSame { return first == .orderedAscending }
                return lhs.displayName.localizedCaseInsensitiveCompare(rhs.displayName) == .orderedAscending
            }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            PageHeader(
                title: "Mitglieder",
                subtitle: "\(store.members.filter(\.active).count) aktiv · \(store.members.filter { !$0.active }.count) inaktiv"
            )

            VStack(spacing: 10) {
                HStack {
                    TextField("Vorname", text: $firstName).textFieldStyle(.roundedBorder)
                    TextField("Nachname", text: $lastName).textFieldStyle(.roundedBorder)
                }
                HStack {
                    TextField("Verein/Klasse", text: $club).textFieldStyle(.roundedBorder)
                    TextField("Notiz", text: $notes).textFieldStyle(.roundedBorder)
                }
                HStack {
                    Button(editID == nil ? "Schütze hinzufügen" : "Änderung speichern") { save() }
                        .buttonStyle(.borderedProminent)
                    if editID != nil {
                        Button("Abbrechen") { reset() }
                            .buttonStyle(.bordered)
                    }
                    Spacer()
                }
            }
            .appCard()

            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                TextField("Nach Vorname oder Nachname suchen", text: $searchText)
                    .textFieldStyle(.plain)
                if !searchText.isEmpty {
                    Button {
                        searchText = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(AppTheme.line))
            .shadow(color: .black.opacity(0.06), radius: 12, x: 0, y: 7)

            ScrollView {
                LazyVStack(spacing: 10) {
                    ForEach(visibleMembers) { m in
                        HStack(spacing: 12) {
                            Image(systemName: m.active ? "person.crop.circle.fill" : "person.crop.circle.badge.xmark")
                                .font(.title2)
                                .foregroundStyle(m.active ? Color.accentColor : Color.secondary)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(m.displayName).font(.headline)
                                Text(m.club.isEmpty ? "Keine Klasse hinterlegt" : m.club)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button("Bearbeiten") { edit(m) }
                            Button(m.active ? "Deaktivieren" : "Inaktiv") {
                                store.deactivateMember(m.id)
                            }
                            .foregroundStyle(.red)
                        }
                        .appCard()
                    }
                }
            }
        }
        .padding(24)
        .liquidPage()
    }

    private func save() {
        guard !firstName.trimmingCharacters(in: .whitespaces).isEmpty,
              !lastName.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        let now = Date()
        let member = Member(
            id: editID ?? UUID(),
            firstName: firstName,
            lastName: lastName,
            displayName: "\(firstName) \(lastName)",
            club: club,
            notes: notes,
            active: true,
            createdAt: now,
            updatedAt: now
        )
        store.upsertMember(member)
        reset()
    }

    private func edit(_ m: Member) {
        editID = m.id
        firstName = m.firstName
        lastName = m.lastName
        club = m.club
        notes = m.notes
    }

    private func reset() {
        editID = nil
        firstName = ""
        lastName = ""
        club = ""
        notes = ""
    }
}
