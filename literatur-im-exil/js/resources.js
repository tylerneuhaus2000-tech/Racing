export function applyEffects(player, effects = {}) {
  const keys = ["money", "documents", "contacts", "literature", "safety", "helped"];
  keys.forEach(key => {
    if (typeof effects[key] === "number") {
      player[key] = Math.max(0, (player[key] || 0) + effects[key]);
    }
  });
}

export function effectText(effects = {}) {
  const labels = { money: "Geld", documents: "Dokumente", contacts: "Kontakte", literature: "Literatur", safety: "Sicherheit", helped: "Hilfe" };
  return Object.entries(effects).map(([key, value]) => `${value > 0 ? "+" : ""}${value} ${labels[key] || key}`).join(", ") || "Keine direkte Änderung";
}
