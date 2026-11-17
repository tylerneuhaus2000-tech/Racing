export const decisionCards = [
  {
    id: "stellungnahme",
    era: "deutschland",
    title: "Öffentliche Stellungnahme",
    text: "Die politische Lage verschärft sich. Eine klare Haltung kann sichtbar machen, was geschieht, erhöht aber das Risiko.",
    options: [
      { label: "Öffentlich Stellung beziehen", effects: { literature: 3, safety: -1 } },
      { label: "Zunächst vorsichtig bleiben", effects: { contacts: 1 } }
    ],
    historicalContext: "Das Spiel bewertet diese Entscheidung nicht als einfache Gewinnerwahl. Sichtbarkeit und Schutz stehen in Spannung."
  },
  {
    id: "dokumente-teilen",
    era: "flucht",
    title: "Papiere teilen",
    text: "Ein anderer Exilant braucht dringend Hilfe bei der Weiterreise.",
    options: [
      { label: "Ein Dokument weitergeben", effects: { documents: -1, literature: 3, helped: 1 } },
      { label: "Kontakt vermitteln", effects: { contacts: -1, literature: 2, helped: 1 } },
      { label: "Eigene Reise sichern", effects: { money: 1 } }
    ],
    historicalContext: "Hilfe im Exil war oft eine Frage knapper Ressourcen."
  },
  {
    id: "sanary-arbeit",
    era: "sanary",
    title: "Arbeit im Exil",
    text: "Du kannst an einem Manuskript arbeiten oder Kontakte für eine Publikation pflegen.",
    options: [
      { label: "Am Manuskript arbeiten", effects: { literature: 2 } },
      { label: "Publikationskontakte pflegen", effects: { contacts: 1, literature: 1 } }
    ],
    historicalContext: "Exilliteratur braucht sowohl Schreiben als auch Wege zur Veröffentlichung."
  },
  {
    id: "konsulat",
    era: "marseille",
    title: "Warten vor dem Konsulat",
    text: "Zeit, Geld und Dokumente sind knapp. Welche Priorität setzt du?",
    options: [
      { label: "Gebühren und Unterkunft bezahlen", effects: { money: -2, documents: 1 } },
      { label: "Netzwerk um Hilfe bitten", effects: { contacts: -1, documents: 1, literature: 1 } },
      { label: "Auf bessere Gelegenheit warten", effects: { safety: 1 } }
    ],
    historicalContext: "Bürokratie und Zufall entschieden oft über Bewegungsmöglichkeiten."
  },
  {
    id: "pyrenaeen",
    era: "marseille",
    title: "Pyrenäenroute",
    text: "Eine gefährliche Route steht im Raum. Der Schritt erfordert Vorbereitung und darf nicht leichtfertig erzählt werden.",
    options: [
      { label: "Nur mit Dokumenten und Kontakt gehen", effects: { documents: -1, contacts: -1, literature: 4 } },
      { label: "Weitere Hilfe suchen", effects: { contacts: 1, money: -1 } }
    ],
    historicalContext: "Die Route verweist auf reale Gefahr. Walter Benjamins Schicksal wird im Spiel sachlich erinnert, nicht als komische Strafe genutzt."
  }
];
