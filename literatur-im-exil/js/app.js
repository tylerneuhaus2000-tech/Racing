import { books } from "../data/books.js";
import { characters } from "../data/characters.js";

const panel = document.querySelector("#info-panel");
const views = {
  story: () => `<h2>Story</h2><p>Die Partie folgt einer historischen Bewegung: Deutschland 1933, Flucht und Exil, Sanary-sur-Mer und Marseille 1940. Jedes Kapitel verändert Ressourcen, Risiken und Handlungsmöglichkeiten.</p><div class="chapter-grid"><article><strong>Kapitel I</strong><span>Der Winter der Literatur</span><small>Startbar im Brettspiel</small></article><article><strong>Kapitel II</strong><span>Die Sonne von Sanary</span><small>Als Brettbereich spielbar</small></article><article><strong>Kapitel III</strong><span>Die große Flucht</span><small>Als Brettbereich spielbar</small></article></div>`,
  books: () => `<h2>Bücher</h2><div class="chapter-grid">${books.map(book => `<article><strong>${book.title}</strong><span>${book.author}</span><small>${book.period}</small><p>${book.summary}</p></article>`).join("")}</div>`,
  figures: () => `<h2>Figuren</h2><div class="chapter-grid">${characters.map(c => `<article><strong>${c.name}</strong><span>${c.ability}</span><small>${c.books.join(", ")}</small><p>${c.description}</p></article>`).join("")}</div>`,
  rules: () => `<h2>Spielregeln</h2><p>2-4 Spieler würfeln, bewegen ihre Figur über 32 Felder und sammeln Literaturpunkte. Orte werden dokumentiert, Karten lösen Fragen, Ereignisse oder Entscheidungen aus. Nach 15 Runden gewinnt die höchste Literaturwertung.</p>`,
  settings: () => `<h2>Einstellungen</h2><p>Sound ist im Spiel über den Schalter im HUD aktivierbar. Spielstände werden lokal im Browser gespeichert.</p>`
};

document.querySelectorAll("[data-panel]").forEach(button => {
  button.addEventListener("click", () => {
    panel.innerHTML = views[button.dataset.panel]();
  });
});
