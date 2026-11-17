import SwiftUI

struct RulesView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                PageHeader(
                    title: "Regelwerk",
                    subtitle: "Schneller Überblick für die Erfassung und Auswertung"
                )

                ruleSection("Zeitlimits") {
                    RuleRow(title: "Pistole · Variante 1", value: "80 Sekunden", detail: "Abbruchhinweis ab 160 Sekunden")
                    RuleRow(title: "Pistole · Variante 2", value: "60 Sekunden", detail: "Abbruchhinweis ab 120 Sekunden")
                    RuleRow(title: "Revolver · Variante 1", value: "80 Sekunden", detail: "Abbruchhinweis ab 160 Sekunden")
                    RuleRow(title: "Revolver · Variante 2", value: "70 Sekunden", detail: "Abbruchhinweis ab 140 Sekunden")
                    RuleRow(title: "Gewehr · Variante 1", value: "70 Sekunden", detail: "Unterhebelrepetierbüchse")
                    RuleRow(title: "Gewehr · Variante 2", value: "50 Sekunden", detail: "Halbautomatische Büchse / Pistole mit Anschlagschaft")
                }

                ruleSection("Ablauf Gewehr / Büchse") {
                    RuleRow(title: "Fertigkeit · 15 m", value: "kniend", detail: "5 Schuss in 15 Sekunden")
                    RuleRow(title: "Fertigkeit · 20 m", value: "stehend", detail: "5 Schuss in 15 Sekunden")
                    RuleRow(title: "Fertigkeit · 25 m", value: "kniend", detail: "5 Schuss in 15 Sekunden")
                    Divider()
                    RuleRow(title: "Parcours · 25 m", value: "stehend", detail: "5 Schuss auf die 1. Scheibe von links")
                    RuleRow(title: "Parcours · 20 m", value: "kniend", detail: "5 Schuss auf die 2. Scheibe von links")
                    RuleRow(title: "Parcours · 15 m", value: "stehend", detail: "5 Schuss auf die 3. Scheibe von links")
                }

                ruleSection("Sammlung Gewehr / Büchse") {
                    RuleRow(title: "Anschlag", value: "jagdlich", detail: "Geschossen wird im jagdlichen Anschlag")
                    RuleRow(title: "Scheibe", value: "BDS KW", detail: "BDS Kurzwaffenscheibe")
                    RuleRow(title: "Kaliber", value: "KK / GK", detail: "Klein- und Großkaliber")
                    RuleRow(title: "Visierung", value: "offen / optisch", detail: "Offene oder optische Visierung möglich")
                    RuleRow(title: "Magazine", value: "3 x 5", detail: "Start mit 3 Magazinen à 5 Schuss möglich")
                    RuleRow(title: "Gesamtprogramm", value: "30 Schuss", detail: "15 Schuss Fertigkeit + 15 Schuss Parcours")
                }

                ruleSection("Zeitabzug") {
                    Text("Für jede volle Sekunde über dem Zeitlimit wird 1 Ring abgezogen. Die App rundet nicht auf, sondern zählt nur volle Sekunden über dem Limit.")
                        .font(.body)
                        .foregroundStyle(.secondary)
                }

                ruleSection("Wertung") {
                    RuleRow(title: "Fertigkeit", value: "max. 200", detail: "Gesamtringe Fertigkeit")
                    RuleRow(title: "Parcours", value: "max. 200", detail: "Gesamtringe Parcours vor Abzügen")
                    RuleRow(title: "Gesamt", value: "max. 400", detail: "Fertigkeit + finaler Parcours")
                }

                ruleSection("Regelabzug") {
                    Text("Bei falschem Anschlag oder überschrittener Entfernungsmarkierung kann ein manueller Regelabzug eingetragen werden. Die App zeigt Warnungen, wenn ein Regelverstoß markiert ist, aber kein Abzug gesetzt wurde.")
                        .font(.body)
                        .foregroundStyle(.secondary)
                }

                ruleSection("Status") {
                    RuleRow(title: "Gültig", value: "zählt", detail: "Wird für Ranglisten und persönliche Bestwerte verwendet")
                    RuleRow(title: "DQ", value: "0 Punkte", detail: "Bleibt sichtbar, zählt aber nicht als Bestwert")
                    RuleRow(title: "Abbruch", value: "sichtbar", detail: "Für Historie und Dokumentation")
                }
            }
            .padding(24)
        }
        .liquidPage()
    }

    private func ruleSection<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.headline)
            content()
        }
        .appCard()
    }
}

private struct RuleRow: View {
    let title: String
    let value: String
    let detail: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text(value)
                .font(.system(.headline, design: .rounded, weight: .bold))
                .monospacedDigit()
        }
        .padding(.vertical, 4)
    }
}
