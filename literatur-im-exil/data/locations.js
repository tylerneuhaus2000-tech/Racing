const field = (id, name, type, era, options = {}) => ({
  id,
  name,
  type,
  era,
  price: 0,
  fee: 0,
  ownerId: null,
  level: 0,
  group: null,
  groupColor: "#c4b496",
  ...options
});

export const boardFields = [
  field("start", "Start", "start", "deutschland"),
  field("berlin", "Berlin", "location", "deutschland", { price: 2, fee: 1, group: "Deutschland 1933", groupColor: "#6f737b" }),
  field("lit1", "Literaturkarte", "literature", "deutschland"),
  field("verlag", "Verlag", "location", "deutschland", { price: 2, fee: 1, group: "Deutschland 1933", groupColor: "#6f737b" }),
  field("steuer1", "Druckkosten", "tax", "deutschland", { fee: 2 }),
  field("bahnhof-berlin", "Bahnhof Berlin", "travel", "deutschland", { price: 4, fee: 1, group: "Bahnhöfe", groupColor: "#111820" }),
  field("akademie", "Akademie der Künste", "location", "deutschland", { price: 3, fee: 1, group: "Berlin", groupColor: "#8c4b4d" }),
  field("ev1", "Ereignis", "event", "deutschland"),
  field("muenchen", "München", "location", "deutschland", { price: 3, fee: 1, group: "Berlin", groupColor: "#8c4b4d" }),
  field("pressehaus", "Pressehaus", "location", "deutschland", { price: 3, fee: 1, group: "Berlin", groupColor: "#8c4b4d" }),
  field("warteraum", "Warteraum", "rest", "flucht"),
  field("grenze", "Grenze", "travel", "flucht", { price: 4, fee: 1, group: "Bahnhöfe", groupColor: "#111820" }),
  field("paris", "Paris", "location", "flucht", { price: 4, fee: 1, group: "Fluchtorte", groupColor: "#44745b" }),
  field("dokumente", "Dokumente", "event", "flucht"),
  field("schweiz", "Schweiz", "location", "flucht", { price: 4, fee: 1, group: "Fluchtorte", groupColor: "#44745b" }),
  field("reiseabgabe", "Reiseabgabe", "tax", "flucht", { fee: 2 }),
  field("exil", "Exilankunft", "travel", "flucht", { price: 4, fee: 1, group: "Bahnhöfe", groupColor: "#111820" }),
  field("zuerich", "Zürich", "location", "flucht", { price: 5, fee: 2, group: "Fluchtorte", groupColor: "#44745b" }),
  field("dec1", "Entscheidung", "decision", "flucht"),
  field("amsterdam", "Amsterdam", "location", "flucht", { price: 5, fee: 2, group: "Fluchtorte", groupColor: "#44745b" }),
  field("internierung", "Internierung", "penalty", "flucht"),
  field("sanary", "Sanary-sur-Mer", "location", "sanary", { price: 6, fee: 2, group: "Sanary", groupColor: "#dfb547" }),
  field("lit2", "Literaturkarte", "literature", "sanary"),
  field("haus-mann", "Haus der Familie Mann", "location", "sanary", { price: 6, fee: 2, group: "Sanary", groupColor: "#dfb547" }),
  field("strand", "Strand", "location", "sanary", { price: 6, fee: 2, group: "Sanary", groupColor: "#dfb547" }),
  field("hafenbahn", "Hafenbahn", "travel", "marseille", { price: 4, fee: 1, group: "Bahnhöfe", groupColor: "#111820" }),
  field("cafe", "Café", "location", "sanary", { price: 7, fee: 2, group: "Sanary", groupColor: "#dfb547" }),
  field("sammlung", "Die Sammlung", "event", "sanary"),
  field("literaturtreffen", "Literaturtreffen", "location", "sanary", { price: 7, fee: 2, group: "Sanary", groupColor: "#dfb547" }),
  field("sonnensteuer", "Exilkosten", "tax", "sanary", { fee: 3 }),
  field("frei", "Freier Aufenthalt", "rest", "sanary"),
  field("frankreich-1940", "Frankreich 1940", "event", "marseille"),
  field("marseille", "Marseille", "location", "marseille", { price: 8, fee: 3, group: "Marseille 1940", groupColor: "#2e6f86" }),
  field("alter-hafen", "Alter Hafen", "location", "marseille", { price: 8, fee: 3, group: "Marseille 1940", groupColor: "#2e6f86" }),
  field("konsulat", "Konsulat", "decision", "marseille"),
  field("varian-fry", "Varian Fry", "event", "marseille"),
  field("air-bel", "Villa Air-Bel", "location", "marseille", { price: 9, fee: 3, group: "Marseille 1940", groupColor: "#2e6f86" }),
  field("pyrenaeen", "Pyrenäenroute", "travel", "marseille", { price: 4, fee: 1, group: "Bahnhöfe", groupColor: "#111820" }),
  field("lissabon", "Lissabon", "location", "marseille", { price: 9, fee: 3, group: "Marseille 1940", groupColor: "#2e6f86" }),
  field("finale", "Übersee", "final", "marseille")
].map((item, index) => ({ ...item, index }));

export const locationSets = boardFields.reduce((sets, item) => {
  if (item.group && (item.type === "location" || item.type === "travel")) {
    sets[item.group] = sets[item.group] || [];
    sets[item.group].push(item.id);
  }
  return sets;
}, {});
