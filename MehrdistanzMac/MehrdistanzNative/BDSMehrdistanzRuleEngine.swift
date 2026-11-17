import Foundation

enum BDSMehrdistanzRuleEngine {
    // Zentrale Regellogik. Anpassungen nur hier vornehmen.
    static func evaluate(_ result: ResultRecord) -> ComputedResult {
        let fertigkeit = max(0, min(200, result.fertigkeitTotal))
        let parcoursRaw = max(0, min(200, result.parcoursRawTotal))

        let timeConfig = timeConfig(for: result.parcoursVariant, weapon: result.weaponType)
        let timePenalty = calcTimePenalty(seconds: result.parcoursTimeSeconds, target: timeConfig.target)
        let abortHint = (result.parcoursTimeSeconds ?? 0) >= Double(timeConfig.abortAt)

        var warnings: [String] = []

        // Bei fehlenden Detailtreffern keine erfundene Automatik:
        // Wir erlauben hier eine manuelle Korrektur und geben sonst Warnhinweis aus.
        let needsProceduralCheck = result.falseStance || result.distanceMarkExceeded
        let proceduralPenalty: Int
        if needsProceduralCheck {
            if let manual = result.manualProceduralPenalty {
                proceduralPenalty = max(0, manual)
            } else {
                proceduralPenalty = 0
                if result.faultyShotsCount > 0 {
                    warnings.append("Regelabzug für fehlerhafte Schüsse bitte manuell setzen (Detailtreffer fehlen).")
                } else {
                    warnings.append("Verfahrensfehler markiert: manuellen Regelabzug prüfen.")
                }
            }
        } else {
            proceduralPenalty = 0
        }

        let parcoursFinal = max(0, parcoursRaw - timePenalty - proceduralPenalty)
        var overall = max(0, fertigkeit + parcoursFinal)

        // DQ niemals als PB zählen, aber Historie sichtbar lassen.
        if result.status == .dq {
            overall = 0
        }

        return ComputedResult(
            fertigkeit: fertigkeit,
            parcoursRaw: parcoursRaw,
            timePenalty: timePenalty,
            proceduralPenalty: proceduralPenalty,
            parcoursFinal: parcoursFinal,
            overallTotal: overall,
            abortHint: abortHint,
            warnings: warnings
        )
    }

    private static func calcTimePenalty(seconds: Double?, target: Int) -> Int {
        guard let seconds else { return 0 }
        let over = max(0.0, seconds - Double(target))
        return Int(floor(over)) // volle Sekunden, nie aufrunden
    }

    private static func timeConfig(for variant: ParcoursVariant, weapon: WeaponType) -> (target: Int, abortAt: Int) {
        if weapon == .gewehr {
            switch variant {
            case .variante1:
                return (70, 140)
            case .variante2:
                return (50, 100)
            }
        }

        switch variant {
        case .variante1:
            return (80, 160)
        case .variante2:
            switch weapon {
            case .pistole:
                return (60, 120)
            case .revolver:
                return (70, 140)
            case .gewehr:
                return (50, 100)
            }
        }
    }
}
