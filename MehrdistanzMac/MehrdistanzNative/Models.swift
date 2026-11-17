import Foundation

enum WeaponType: String, Codable, CaseIterable, Identifiable {
    case pistole
    case revolver
    case gewehr
    var id: String { rawValue }
    var label: String {
        switch self {
        case .pistole: return "Pistole"
        case .revolver: return "Revolver"
        case .gewehr: return "Gewehr"
        }
    }
}

enum ParcoursVariant: String, Codable, CaseIterable, Identifiable {
    case variante1
    case variante2
    var id: String { rawValue }
    var label: String { self == .variante1 ? "Variante 1" : "Variante 2" }
}

enum ResultStatus: String, Codable, CaseIterable, Identifiable {
    case gueltig
    case abbruch
    case dq
    var id: String { rawValue }
    var label: String {
        switch self {
        case .gueltig: return "Gültig"
        case .abbruch: return "Abbruch"
        case .dq: return "DQ"
        }
    }
}

struct Member: Identifiable, Codable, Hashable {
    var id: UUID
    var firstName: String
    var lastName: String
    var displayName: String
    var club: String
    var notes: String
    var active: Bool
    var createdAt: Date
    var updatedAt: Date
}

struct MonthSlot: Identifiable, Codable, Hashable {
    var id: UUID
    var label: String
    var month: Int
    var year: Int
    var startDate: Date
    var endDate: Date
    var sortIndex: Int
    var seasonLabel: String
}

struct ResultRecord: Identifiable, Codable, Hashable {
    var id: UUID
    var memberId: UUID
    var monthSlotId: UUID
    var exactDate: Date?
    var discipline: String
    var weaponType: WeaponType
    var parcoursVariant: ParcoursVariant
    var status: ResultStatus

    // Nur Gesamteingaben (wie gewünscht)
    var fertigkeitTotal: Int
    var parcoursRawTotal: Int
    var parcoursTimeSeconds: Double?

    var falseStance: Bool
    var distanceMarkExceeded: Bool
    var faultyShotsCount: Int
    var manualProceduralPenalty: Int?
    var dqReason: String
    var notes: String

    var createdAt: Date
    var updatedAt: Date
}

struct ComputedResult: Hashable {
    var fertigkeit: Int
    var parcoursRaw: Int
    var timePenalty: Int
    var proceduralPenalty: Int
    var parcoursFinal: Int
    var overallTotal: Int
    var abortHint: Bool
    var warnings: [String]
}

struct PersistedData: Codable {
    var members: [Member]
    var monthSlots: [MonthSlot]
    var results: [ResultRecord]
}
