import Foundation

@MainActor
final class AppStore: ObservableObject {
    @Published var members: [Member] = []
    @Published var monthSlots: [MonthSlot] = []
    @Published var results: [ResultRecord] = []

    private let calendar = Calendar(identifier: .gregorian)
    private let fileURL: URL

    init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let folder = support.appendingPathComponent("MehrdistanzNative", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        self.fileURL = folder.appendingPathComponent("data.json")
        load()
    }

    // MARK: - Persistenz
    func save() {
        let payload = PersistedData(members: members, monthSlots: monthSlots, results: results)
        guard let data = try? JSONEncoder().encode(payload) else { return }
        try? data.write(to: fileURL, options: .atomic)
    }

    private func load() {
        guard
            let data = try? Data(contentsOf: fileURL),
            let payload = try? JSONDecoder().decode(PersistedData.self, from: data)
        else {
            bootstrap()
            return
        }
        members = payload.members
        monthSlots = payload.monthSlots.sorted(by: { $0.sortIndex < $1.sortIndex })
        results = payload.results.sorted(by: { $0.createdAt > $1.createdAt })

        ensureDefaultMonthSlots()
        ensureSeedMembers()
        markCurrentMonthExists()
        save()
    }

    private func bootstrap() {
        if importBundledBackupIfAvailable() {
            ensureDefaultMonthSlots()
            markCurrentMonthExists()
            save()
            return
        }

        ensureDefaultMonthSlots()
        ensureSeedMembers()
        save()
    }

    // MARK: - Month Slots
    func appendNext12Months() {
        guard let last = monthSlots.max(by: { $0.sortIndex < $1.sortIndex }) else {
            ensureDefaultMonthSlots()
            save()
            return
        }
        var nextMonth = last.month + 1
        var nextYear = last.year
        if nextMonth > 12 {
            nextMonth = 1
            nextYear += 1
        }

        var index = last.sortIndex + 1
        for _ in 0..<12 {
            if !monthSlots.contains(where: { $0.month == nextMonth && $0.year == nextYear }) {
                monthSlots.append(makeMonthSlot(month: nextMonth, year: nextYear, sortIndex: index))
                index += 1
            }
            nextMonth += 1
            if nextMonth > 12 {
                nextMonth = 1
                nextYear += 1
            }
        }
        monthSlots.sort(by: { $0.sortIndex < $1.sortIndex })
        save()
    }

    func currentMonthSlotID() -> UUID? {
        let now = Date()
        let currentMonth = calendar.component(.month, from: now)
        let currentYear = calendar.component(.year, from: now)

        if let exact = monthSlots.first(where: { $0.month == currentMonth && $0.year == currentYear }) {
            return exact.id
        }

        // Nächstpassender Bereich
        let sorted = monthSlots.sorted(by: { $0.sortIndex < $1.sortIndex })
        let target = currentYear * 100 + currentMonth
        let closest = sorted.min(by: { abs(($0.year * 100 + $0.month) - target) < abs(($1.year * 100 + $1.month) - target) })
        return closest?.id
    }

    private func ensureDefaultMonthSlots() {
        guard monthSlots.isEmpty else { return }
        var index = 0
        var month = 5
        var year = 2026
        while true {
            monthSlots.append(makeMonthSlot(month: month, year: year, sortIndex: index))
            if month == 5 && year == 2027 { break }
            index += 1
            month += 1
            if month > 12 {
                month = 1
                year += 1
            }
        }
    }

    private func markCurrentMonthExists() {
        guard currentMonthSlotID() == nil else { return }
        appendNext12Months()
    }

    private func makeMonthSlot(month: Int, year: Int, sortIndex: Int) -> MonthSlot {
        let start = calendar.date(from: DateComponents(year: year, month: month, day: 1)) ?? Date()
        let end = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: start) ?? start
        let label = DateFormatter.germanMonthYear.string(from: start)
        return MonthSlot(
            id: UUID(),
            label: label,
            month: month,
            year: year,
            startDate: start,
            endDate: end,
            sortIndex: sortIndex,
            seasonLabel: "Saison \(year)/\(String((year + 1) % 100).padding(toLength: 2, withPad: "0", startingAt: 0))"
        )
    }

    // MARK: - Member
    func upsertMember(_ member: Member) {
        if let idx = members.firstIndex(where: { $0.id == member.id }) {
            members[idx] = member
        } else {
            members.append(member)
        }
        members.sort(by: { $0.lastName.localizedCaseInsensitiveCompare($1.lastName) == .orderedAscending })
        save()
    }

    func deactivateMember(_ memberID: UUID) {
        guard let idx = members.firstIndex(where: { $0.id == memberID }) else { return }
        members[idx].active = false
        members[idx].updatedAt = Date()
        save()
    }

    // MARK: - Result
    func upsertResult(_ result: ResultRecord) {
        if let idx = results.firstIndex(where: { $0.id == result.id }) {
            results[idx] = result
        } else {
            results.append(result)
        }
        results.sort(by: { $0.updatedAt > $1.updatedAt })
        save()
    }

    func deleteResult(_ resultID: UUID) {
        results.removeAll(where: { $0.id == resultID })
        save()
    }

    // MARK: - Metrics
    func computed(for result: ResultRecord) -> ComputedResult {
        BDSMehrdistanzRuleEngine.evaluate(result)
    }

    func validResults(for memberID: UUID) -> [ResultRecord] {
        results.filter { $0.memberId == memberID && $0.status == .gueltig }
    }

    func allResults(for memberID: UUID) -> [ResultRecord] {
        results.filter { $0.memberId == memberID }
    }

    func participationCount(for memberID: UUID) -> Int {
        results.filter { $0.memberId == memberID }.count
    }

    func personalBest(for memberID: UUID) -> Int {
        validResults(for: memberID).map { computed(for: $0).overallTotal }.max() ?? 0
    }

    func average(for memberID: UUID) -> Double {
        let vals = validResults(for: memberID).map { Double(computed(for: $0).overallTotal) }
        guard !vals.isEmpty else { return 0 }
        return vals.reduce(0, +) / Double(vals.count)
    }

    func latestValue(for memberID: UUID) -> Int {
        let sorted = allResults(for: memberID).sorted(by: { $0.updatedAt > $1.updatedAt })
        guard let latest = sorted.first else { return 0 }
        return computed(for: latest).overallTotal
    }

    // Monatsbestwert je Schütze (für Trends/Ranking)
    func monthBest(for memberID: UUID, monthSlotID: UUID) -> Int? {
        let vals = results
            .filter { $0.memberId == memberID && $0.monthSlotId == monthSlotID && $0.status == .gueltig }
            .map { computed(for: $0).overallTotal }
        return vals.max()
    }

    // Tagesbestwert (falls exactDate vorhanden), sonst Monatsbestwert
    func bestTimeline(for memberID: UUID) -> [TimelinePoint] {
        let mine = results.filter { $0.memberId == memberID && $0.status == .gueltig }
        var byDay: [String: ResultRecord] = [:]
        var byMonth: [UUID: ResultRecord] = [:]

        for r in mine {
            let score = computed(for: r).overallTotal
            if let day = r.exactDate {
                let key = DateFormatter.isoDay.string(from: day)
                if let old = byDay[key], computed(for: old).overallTotal >= score { continue }
                byDay[key] = r
            } else {
                if let old = byMonth[r.monthSlotId], computed(for: old).overallTotal >= score { continue }
                byMonth[r.monthSlotId] = r
            }
        }

        var points: [TimelinePoint] = []
        for (_, r) in byDay {
            let c = computed(for: r)
            points.append(
                TimelinePoint(
                    id: r.id,
                    date: r.exactDate ?? r.createdAt,
                    xLabel: DateFormatter.shortGerman.string(from: r.exactDate ?? r.createdAt),
                    overall: c.overallTotal,
                    rings: c.fertigkeit + c.parcoursFinal,
                    time: r.parcoursTimeSeconds
                )
            )
        }
        for (_, r) in byMonth {
            guard let slot = monthSlots.first(where: { $0.id == r.monthSlotId }) else { continue }
            let c = computed(for: r)
            points.append(
                TimelinePoint(
                    id: r.id,
                    date: slot.startDate,
                    xLabel: slot.label,
                    overall: c.overallTotal,
                    rings: c.fertigkeit + c.parcoursFinal,
                    time: r.parcoursTimeSeconds
                )
            )
        }
        return points.sorted(by: { $0.date < $1.date })
    }

    // MARK: - Seed
    private func ensureSeedMembers() {
        guard members.isEmpty else { return }
        let now = Date()
        members = SeedData.members.map { row in
            Member(
                id: UUID(),
                firstName: row.firstName,
                lastName: row.lastName,
                displayName: "\(row.firstName) \(row.lastName)",
                club: "",
                notes: "",
                active: true,
                createdAt: now,
                updatedAt: now
            )
        }
        members.sort(by: { $0.lastName.localizedCaseInsensitiveCompare($1.lastName) == .orderedAscending })
    }

    private func importBundledBackupIfAvailable() -> Bool {
        guard
            let url = Bundle.main.url(forResource: "mehrdistanz-backup-1789481673677", withExtension: "json"),
            let data = try? Data(contentsOf: url),
            let backup = try? JSONDecoder.webBackup.decode(WebBackup.self, from: data)
        else {
            return false
        }

        let now = Date()
        let importedSlots = backup.monthSlots.enumerated().map { index, slot in
            MonthSlot(
                id: UUID.stable(from: slot.id),
                label: slot.label,
                month: slot.month,
                year: slot.year,
                startDate: DateFormatter.isoDay.date(from: slot.startDate) ?? now,
                endDate: DateFormatter.isoDay.date(from: slot.endDate) ?? now,
                sortIndex: slot.sortIndex ?? index,
                seasonLabel: slot.seasonLabel ?? "Saison \(slot.year)"
            )
        }

        let importedMembers = backup.members.map { row in
            Member(
                id: UUID.stable(from: row.id),
                firstName: row.firstName,
                lastName: row.lastName,
                displayName: row.displayName.isEmpty ? "\(row.firstName) \(row.lastName)" : row.displayName,
                club: row.club ?? "",
                notes: row.notes ?? "",
                active: row.active ?? true,
                createdAt: now,
                updatedAt: now
            )
        }

        let importedResults = backup.results.map { row in
            ResultRecord(
                id: UUID.stable(from: row.id),
                memberId: UUID.stable(from: row.memberId),
                monthSlotId: UUID.stable(from: row.monthSlotId),
                exactDate: row.exactDate.flatMap { DateFormatter.isoDay.date(from: $0) },
                discipline: row.discipline,
                weaponType: WeaponType(webValue: row.weaponType),
                parcoursVariant: ParcoursVariant(webValue: row.parcoursVariant),
                status: ResultStatus(webValue: row.status),
                fertigkeitTotal: row.fertigkeitTotal,
                parcoursRawTotal: row.parcoursRawTotal,
                parcoursTimeSeconds: row.parcoursTimeSeconds,
                falseStance: row.falseStance ?? false,
                distanceMarkExceeded: row.distanceLineOverstepped ?? false,
                faultyShotsCount: row.faultyShots ?? 0,
                manualProceduralPenalty: row.proceduralPenalty,
                dqReason: row.dqReason ?? "",
                notes: row.notes ?? "",
                createdAt: row.recordedAt ?? now,
                updatedAt: row.recordedAt ?? now
            )
        }

        monthSlots = importedSlots.sorted(by: { $0.sortIndex < $1.sortIndex })
        members = importedMembers.sorted(by: { $0.lastName.localizedCaseInsensitiveCompare($1.lastName) == .orderedAscending })
        results = importedResults.sorted(by: { $0.updatedAt > $1.updatedAt })
        return true
    }
}

struct TimelinePoint: Identifiable, Hashable {
    let id: UUID
    let date: Date
    let xLabel: String
    let overall: Int
    let rings: Int
    let time: Double?
}

private enum SeedData {
    static let members: [(lastName: String, firstName: String)] = [
        ("Schnitzler","Hans-Georg"),("Schnitzler","Gabriele"),("Kurt","Yasar"),("Werner","Igor"),
        ("Biermann","Axel"),("Nowak","Iris"),("Schüssleder","Michael"),("Winter","Thomas"),
        ("Fuhrherr","Klaus Dieter"),("Corukcu","Sabahattin"),("Schmode","Dennis"),("Öz","Cemalettin"),
        ("van gen Hassend","Michael"),("Chiriacov","Alexandr"),("Fedorkov","Igor"),("Stopschinski geb. Luong","Thy"),
        ("Stopschinski","David"),("Fahrenbrach","Christoph"),("Schmenk","Gerhard Wilhelm"),("Knaup","Karla"),
        ("Pajewski","Sascha"),("Pajewski","Julia Anna"),("Bohlen","Jens"),("Noelle","Ralf"),
        ("Schmode-Hettenberger","Edith"),("Dielmann","Benjamin"),("Zakiewicz","Dennis"),("Englert","Malte"),
        ("Will","Christoph"),("Brands","Lisa-Marie"),("Mader","Matthias"),("Mader","Ben"),
        ("Uslu","Bayram"),("Mader","Pia"),("Lazovic","Danijela"),("Schaak","Michael"),
        ("Tosta","Stefan"),("Klaiber","Wolfgang"),("Frieg","Thomas"),("Klinger","Christian"),
        ("Turski","Michael"),("Buteweg","Daniel"),("Sander","Dirk"),("Au","Christian"),
        ("Van der Veer","Andreas"),("Speckens","Pierrè"),("Rickel","Thomas"),("Yavas","Yade"),
        ("Lenz geb. Steilmann","Heike"),("Hüttmann","Klaus"),("Milde","Andreas"),("van Marwyk","Markus"),
        ("Neuhaus","Tyler"),("Buteweg","Sabrina")
    ]
}

private extension DateFormatter {
    static let germanMonthYear: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "de_DE")
        f.dateFormat = "LLLL yyyy"
        return f
    }()
    static let isoDay: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()
    static let shortGerman: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "de_DE")
        f.dateStyle = .medium
        return f
    }()
}

private extension JSONDecoder {
    static let webBackup: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()
}

private extension UUID {
    static func stable(from legacyID: String) -> UUID {
        let bytes = Array(legacyID.utf8)
        let uuidBytes = (0..<16).map { index -> UInt8 in
            var value = UInt8(index &* 17)
            for (offset, byte) in bytes.enumerated() {
                value = value &+ byte &* UInt8(((offset + index) % 13) + 1)
                value = value ^ UInt8((offset * 31 + index * 7) & 0xff)
            }
            return value
        }

        let hex = uuidBytes.map { String(format: "%02x", $0) }.joined()
        let formatted = "\(hex.prefix(8))-\(hex.dropFirst(8).prefix(4))-\(hex.dropFirst(12).prefix(4))-\(hex.dropFirst(16).prefix(4))-\(hex.dropFirst(20).prefix(12))"
        return UUID(uuidString: formatted) ?? UUID()
    }
}

private extension WeaponType {
    init(webValue: String) {
        switch webValue {
        case "REVOLVER":
            self = .revolver
        case "GEWEHR", "BUECHSE", "BÜCHSE", "RIFLE":
            self = .gewehr
        default:
            self = .pistole
        }
    }
}

private extension ParcoursVariant {
    init(webValue: String) {
        self = webValue == "VARIANT_1" ? .variante1 : .variante2
    }
}

private extension ResultStatus {
    init(webValue: String) {
        switch webValue {
        case "DQ": self = .dq
        case "ABBRUCH": self = .abbruch
        default: self = .gueltig
        }
    }
}

private struct WebBackup: Decodable {
    var members: [WebMember]
    var monthSlots: [WebMonthSlot]
    var results: [WebResult]
}

private struct WebMember: Decodable {
    var id: String
    var firstName: String
    var lastName: String
    var displayName: String
    var club: String?
    var notes: String?
    var active: Bool?
}

private struct WebMonthSlot: Decodable {
    var id: String
    var label: String
    var month: Int
    var year: Int
    var startDate: String
    var endDate: String
    var sortIndex: Int?
    var seasonLabel: String?
}

private struct WebResult: Decodable {
    var id: String
    var memberId: String
    var monthSlotId: String
    var exactDate: String?
    var discipline: String
    var weaponType: String
    var parcoursVariant: String
    var status: String
    var fertigkeitTotal: Int
    var parcoursRawTotal: Int
    var parcoursTimeSeconds: Double?
    var falseStance: Bool?
    var distanceLineOverstepped: Bool?
    var faultyShots: Int?
    var proceduralPenalty: Int?
    var dqReason: String?
    var notes: String?
    var recordedAt: Date?
}
