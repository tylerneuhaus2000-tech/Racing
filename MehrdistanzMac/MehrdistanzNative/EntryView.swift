import SwiftUI

struct EntryView: View {
    @EnvironmentObject private var store: AppStore

    @State private var editingID: UUID?
    @State private var memberID: UUID?
    @State private var monthSlotID: UUID?
    @State private var useExactDate = false
    @State private var exactDate = Date()
    @State private var discipline = "BDS Mehrdistanz Kurzwaffe"
    @State private var weapon: WeaponType = .pistole
    @State private var variant: ParcoursVariant = .variante2
    @State private var status: ResultStatus = .gueltig
    @State private var fertigkeitTotal = ""
    @State private var parcoursRawTotal = ""
    @State private var parcoursTime = ""
    @State private var falseStance = false
    @State private var distanceMarkExceeded = false
    @State private var faultyShots = 0
    @State private var manualProceduralPenalty = ""
    @State private var dqReason = ""
    @State private var notes = ""
    @State private var message = ""

    private var selectedMemberResults: [ResultRecord] {
        guard let memberID else { return [] }
        return store.results.filter { $0.memberId == memberID }.sorted(by: { $0.updatedAt > $1.updatedAt })
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                PageHeader(
                    title: "Eintragen",
                    subtitle: editingID == nil ? "Neues Mehrdistanz-Ergebnis erfassen" : "Bestehenden Eintrag bearbeiten"
                )

                form

                HStack {
                    Button(editingID == nil ? "Speichern" : "Änderungen speichern") {
                        save()
                    }
                    .buttonStyle(.borderedProminent)

                    if editingID != nil {
                        Button("Abbrechen") {
                            resetForm()
                        }
                        .buttonStyle(.bordered)
                    }
                }

                if !message.isEmpty {
                    Text(message).font(.footnote).foregroundStyle(.secondary)
                }

                VStack(alignment: .leading, spacing: 10) {
                    Text("Historie")
                        .font(.headline)
                    if selectedMemberResults.isEmpty {
                        Text("Für die aktuelle Auswahl gibt es noch keine Einträge.")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                            .appCard()
                    } else {
                        ForEach(selectedMemberResults) { r in
                            historyRow(r)
                        }
                    }
                }
            }
            .padding(24)
        }
        .liquidPage()
        .onAppear {
            monthSlotID = monthSlotID ?? store.currentMonthSlotID()
            memberID = memberID ?? store.members.first(where: \.active)?.id
        }
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top, spacing: 16) {
                VStack(spacing: 10) {
                    Picker("Schütze", selection: $memberID) {
                        ForEach(store.members.filter(\.active).sorted(by: { $0.lastName < $1.lastName })) { m in
                            Text(m.displayName).tag(Optional(m.id))
                        }
                    }
                    .pickerStyle(.menu)

                    Picker("Monats-Slot", selection: $monthSlotID) {
                        ForEach(store.monthSlots.sorted(by: { $0.sortIndex < $1.sortIndex })) { slot in
                            Text(slot.label.capitalized).tag(Optional(slot.id))
                        }
                    }
                    .pickerStyle(.menu)

                    Toggle("Exaktes Datum speichern", isOn: $useExactDate)
                    if useExactDate {
                        DatePicker("Tag", selection: $exactDate, displayedComponents: .date)
                    }
                }
                .appCard()

                VStack(spacing: 10) {
                    TextField("Disziplin / Klasse", text: $discipline)
                        .textFieldStyle(.roundedBorder)

                    Picker("Waffentyp", selection: $weapon) {
                        ForEach(WeaponType.allCases) { t in Text(t.label).tag(t) }
                    }
                    .pickerStyle(.segmented)

                    Picker("Parcours-Variante", selection: $variant) {
                        ForEach(ParcoursVariant.allCases) { t in Text(t.label).tag(t) }
                    }
                    .pickerStyle(.segmented)

                    Picker("Status", selection: $status) {
                        ForEach(ResultStatus.allCases) { s in Text(s.label).tag(s) }
                    }
                    .pickerStyle(.segmented)
                }
                .appCard()
            }

            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Wertung").font(.headline)
                    TextField("Fertigkeit Gesamt-Ringe", text: $fertigkeitTotal)
                        .numberInputKeyboard()
                        .textFieldStyle(.roundedBorder)
                    TextField("Parcours Gesamt-Ringe", text: $parcoursRawTotal)
                        .numberInputKeyboard()
                        .textFieldStyle(.roundedBorder)
                    TextField("Parcourszeit (Sekunden)", text: $parcoursTime)
                        .decimalInputKeyboard()
                        .textFieldStyle(.roundedBorder)
                }
                .appCard()

                VStack(alignment: .leading, spacing: 10) {
                    Text("Regelprüfung").font(.headline)
                    Toggle("Falscher Anschlag", isOn: $falseStance)
                    Toggle("Entfernungsmarkierung überschritten", isOn: $distanceMarkExceeded)
                    Stepper("Fehlerhaft abgegebene Schüsse: \(faultyShots)", value: $faultyShots, in: 0...20)
                    TextField("Manueller Regelabzug (optional)", text: $manualProceduralPenalty)
                        .numberInputKeyboard()
                        .textFieldStyle(.roundedBorder)
                }
                .appCard()
            }

            VStack(spacing: 10) {
                TextField("DQ/Abbruch Grund (optional)", text: $dqReason)
                    .textFieldStyle(.roundedBorder)
                TextField("Notiz", text: $notes, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
            }
            .appCard()
        }
    }

    private func historyRow(_ record: ResultRecord) -> some View {
        let computed = store.computed(for: record)
        return VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("\(record.status.label) • Gesamt \(computed.overallTotal)")
                    .font(.subheadline.bold())
                Spacer()
                Button("Bearbeiten") { load(record) }
                Button(role: .destructive) { store.deleteResult(record.id) } label: { Text("Löschen") }
            }
            Text("Zeitabzug \(computed.timePenalty), Regelabzug \(computed.proceduralPenalty), Parcours final \(computed.parcoursFinal)")
                .font(.caption)
                .foregroundStyle(.secondary)
            if !computed.warnings.isEmpty {
                Text(computed.warnings.joined(separator: " "))
                    .font(.caption)
                    .foregroundStyle(.orange)
            }
        }
        .appCard()
    }

    private func save() {
        guard let memberID, let monthSlotID else {
            message = "Bitte Schütze und Monats-Slot auswählen."
            return
        }

        let fert = Int(fertigkeitTotal) ?? 0
        let parc = Int(parcoursRawTotal) ?? 0
        let time = Double(parcoursTime.replacingOccurrences(of: ",", with: "."))
        let manualPenalty = Int(manualProceduralPenalty)

        let now = Date()
        var record = ResultRecord(
            id: editingID ?? UUID(),
            memberId: memberID,
            monthSlotId: monthSlotID,
            exactDate: useExactDate ? exactDate : nil,
            discipline: discipline,
            weaponType: weapon,
            parcoursVariant: variant,
            status: status,
            fertigkeitTotal: fert,
            parcoursRawTotal: parc,
            parcoursTimeSeconds: time,
            falseStance: falseStance,
            distanceMarkExceeded: distanceMarkExceeded,
            faultyShotsCount: faultyShots,
            manualProceduralPenalty: manualPenalty,
            dqReason: dqReason,
            notes: notes,
            createdAt: now,
            updatedAt: now
        )
        if let old = store.results.first(where: { $0.id == record.id }) {
            record.createdAt = old.createdAt
        }
        store.upsertResult(record)
        message = editingID == nil ? "Ergebnis gespeichert." : "Ergebnis aktualisiert."
        resetForm(keepSelection: true)
    }

    private func load(_ record: ResultRecord) {
        editingID = record.id
        memberID = record.memberId
        monthSlotID = record.monthSlotId
        useExactDate = record.exactDate != nil
        exactDate = record.exactDate ?? Date()
        discipline = record.discipline
        weapon = record.weaponType
        variant = record.parcoursVariant
        status = record.status
        fertigkeitTotal = String(record.fertigkeitTotal)
        parcoursRawTotal = String(record.parcoursRawTotal)
        parcoursTime = record.parcoursTimeSeconds.map { String($0) } ?? ""
        falseStance = record.falseStance
        distanceMarkExceeded = record.distanceMarkExceeded
        faultyShots = record.faultyShotsCount
        manualProceduralPenalty = record.manualProceduralPenalty.map(String.init) ?? ""
        dqReason = record.dqReason
        notes = record.notes
        message = "Eintrag geladen. Änderungen möglich."
    }

    private func resetForm(keepSelection: Bool = false) {
        editingID = nil
        useExactDate = false
        exactDate = Date()
        discipline = "BDS Mehrdistanz Kurzwaffe"
        weapon = .pistole
        variant = .variante2
        status = .gueltig
        fertigkeitTotal = ""
        parcoursRawTotal = ""
        parcoursTime = ""
        falseStance = false
        distanceMarkExceeded = false
        faultyShots = 0
        manualProceduralPenalty = ""
        dqReason = ""
        notes = ""
        if !keepSelection {
            memberID = nil
            monthSlotID = store.currentMonthSlotID()
        }
    }
}

private extension View {
    @ViewBuilder
    func numberInputKeyboard() -> some View {
        #if os(iOS)
        self.keyboardType(.numberPad)
        #else
        self
        #endif
    }

    @ViewBuilder
    func decimalInputKeyboard() -> some View {
        #if os(iOS)
        self.keyboardType(.decimalPad)
        #else
        self
        #endif
    }
}
