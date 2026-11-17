import { characters } from "../data/characters.js";
import { boardFields, locationSets } from "../data/locations.js";
import { createPlayer } from "./players.js";
import { rollDie, animateDice } from "./dice.js";
import { renderBoard } from "./board.js";
import { movePlayer } from "./movement.js";
import { applyEffects, effectText } from "./resources.js";
import { drawDecision, drawEvent, drawLiterature, showDecision, showInfoCard, showQuiz } from "./cards.js";
import { clearSave, loadGame, saveGame } from "./savegame.js";
import { playTone, setSound } from "./audio.js";

const DEBUG = false;
const SAVE_VERSION = 2;
const app = document.querySelector("#app");

let state = {
  version: SAVE_VERSION,
  phase: "SETUP",
  round: 1,
  maxRounds: 15,
  currentPlayer: 0,
  players: [],
  board: boardFields,
  activeEvents: [],
  history: [],
  debug: DEBUG,
  sound: false,
  lastRoll: null,
  render
};

let setup = { count: 2, names: ["Spieler 1", "Spieler 2"], selected: {} };

function log(message) {
  state.history.unshift(message);
  state.history = state.history.slice(0, 12);
}

function render() {
  if (state.phase === "SETUP" || state.phase === "CHARACTER_SELECTION") return renderSetup();
  if (state.phase === "GAME_OVER") return renderGameOver();
  renderGame();
}

function renderSetup() {
  const choosing = state.phase === "CHARACTER_SELECTION";
  app.innerHTML = `<main class="setup-screen">
    <span class="stamp">Lokale Partie</span>
    <h1>Literatur im Exil</h1>
    <p>Drei Bücher. Drei Zeiten. Eine Geschichte.</p>
    ${!choosing ? setupPlayersMarkup() : characterMarkup()}
  </main>`;
  bindSetup();
}

function setupPlayersMarkup() {
  return `<h2>Spielerstellung</h2>
    <div class="setup-grid">${[2,3,4].map(n => `<button class="setup-card ${setup.count === n ? "selected" : ""}" data-count="${n}"><strong>${n} Spieler</strong><p>Lokale Brettspielrunde</p></button>`).join("")}</div>
    <div class="name-list">${Array.from({ length: setup.count }, (_, i) => `<input data-name="${i}" value="${setup.names[i] || `Spieler ${i + 1}`}" aria-label="Name Spieler ${i + 1}">`).join("")}</div>
    <button class="primary-btn" id="toCharacters">Charaktere wählen</button>
    ${loadGame()?.version === SAVE_VERSION ? `<button class="ghost-btn" id="loadGame">Gespeichertes Spiel laden</button>` : ""}`;
}

function characterMarkup() {
  return `<h2>Charakterauswahl</h2><p>Wähle für jeden Spieler eine andere historische Figur.</p>
    <div class="character-grid">${setup.names.slice(0, setup.count).map((name, playerIndex) => `
      <section class="setup-card"><h3>${name}</h3><div class="character-grid">${characters.map(c => {
        const used = Object.entries(setup.selected).some(([idx, id]) => Number(idx) !== playerIndex && id === c.id);
        return `<button class="character-card ${setup.selected[playerIndex] === c.id ? "selected" : ""}" data-player="${playerIndex}" data-character="${c.id}" ${used ? "disabled" : ""}>
          <div class="portrait" style="background:${c.color}">${c.initials}</div>
          <h4>${c.name}</h4><strong>${c.ability}</strong><p>${c.description}</p><small>${c.difficulty} · ${c.abilityRule}</small>
        </button>`;
      }).join("")}</div></section>`).join("")}</div>
    <button class="primary-btn" id="startGame">Spiel starten</button>
    <button class="ghost-btn" id="backSetup">Zurück</button>`;
}

function bindSetup() {
  app.querySelectorAll("[data-count]").forEach(btn => btn.addEventListener("click", () => {
    setup.count = Number(btn.dataset.count);
    setup.names = Array.from({ length: setup.count }, (_, i) => setup.names[i] || `Spieler ${i + 1}`);
    render();
  }));
  app.querySelectorAll("[data-name]").forEach(input => input.addEventListener("input", () => { setup.names[Number(input.dataset.name)] = input.value; }));
  app.querySelector("#toCharacters")?.addEventListener("click", () => { state.phase = "CHARACTER_SELECTION"; render(); });
  app.querySelector("#backSetup")?.addEventListener("click", () => { state.phase = "SETUP"; render(); });
  app.querySelector("#loadGame")?.addEventListener("click", () => {
    const saved = loadGame();
    if (saved) {
      const savedBoard = saved.board || [];
      state = { ...saved, board: boardFields.map(field => {
        const savedField = savedBoard.find(item => item.id === field.id);
        return { ...field, ownerId: savedField?.ownerId ?? null, level: savedField?.level || 0 };
      }), render };
      state.players = state.players.map(p => ({ ...p, ownedLocations: p.ownedLocations || [], collectedLocations: p.collectedLocations || [], character: characters.find(c => c.id === p.character.id || c.id === p.character) || p.character }));
      state.phase = "TURN_START";
      render();
    }
  });
  app.querySelectorAll("[data-character]").forEach(btn => btn.addEventListener("click", () => {
    setup.selected[Number(btn.dataset.player)] = btn.dataset.character;
    render();
  }));
  app.querySelector("#startGame")?.addEventListener("click", startGame);
}

function startGame() {
  const ready = Array.from({ length: setup.count }, (_, i) => setup.selected[i]).every(Boolean);
  if (!ready) return;
  state.version = SAVE_VERSION;
  state.players = setup.names.slice(0, setup.count).map((name, i) => createPlayer(i, name, characters.find(c => c.id === setup.selected[i])));
  state.board = boardFields.map(field => ({ ...field, ownerId: null }));
  state.phase = "TURN_START";
  state.round = 1;
  state.currentPlayer = 0;
  log("Die Reise beginnt im Januar 1933.");
  render();
}

function renderGame() {
  const player = state.players[state.currentPlayer];
  app.innerHTML = `<main class="game-layout">
    <div class="board-wrap" id="board"></div>
    <aside class="hud">
      <h1>Runde ${state.round} / ${state.maxRounds}</h1>
      <section class="player-card"><div class="player-head"><div class="portrait" style="background:${player.character.color}">${player.character.initials}</div><div><strong>${player.name}</strong><br>${player.character.name}<br><small>${player.character.ability}: ${player.character.abilityRule}</small></div></div></section>
      <div class="resources">
        <div>Geld<span>${player.money}</span></div><div>Dokumente<span>${player.documents}</span></div>
        <div>Kontakte<span>${player.contacts}</span></div><div>Literatur<span>${player.literature}</span></div>
      </div>
      <div class="dice ${state.lastRoll ? "revealed" : ""}" id="dice">${state.lastRoll || "?"}</div>
      <div class="hud-actions">
        <button class="primary-btn" id="roll" ${state.phase !== "TURN_START" ? "disabled" : ""}>Würfeln</button>
        <button class="ghost-btn" id="cardInfo">Karte</button>
        <button class="ghost-btn" id="figureInfo">Figur</button>
        <button class="ghost-btn" id="rulesInfo">Regeln</button>
        ${player.character.id === "varian-fry" ? `<button class="ghost-btn" id="support">Unterstützen</button>` : ""}
        <button class="ghost-btn" id="save">Speichern</button>
        <button class="ghost-btn" id="sound">${state.sound ? "Sound an" : "Sound aus"}</button>
        <a class="ghost-btn" href="index.html">Menü</a>
      </div>
      <section class="inventory"><strong>Inventar</strong><p>${player.ownedLocations?.length || 0} Orte gekauft · ${player.collectedLocations.length} Orte dokumentiert · ${player.correct}/${player.answered} Fragen richtig</p></section>
      <section class="log">${state.history.map(item => `<div>${item}</div>`).join("")}</section>
    </aside>
  </main>`;
  renderBoard(app.querySelector("#board"), state);
  app.querySelector("#roll").addEventListener("click", takeTurn);
  app.querySelector("#save").addEventListener("click", () => { saveGame(state); log("Spielstand lokal gespeichert."); render(); });
  app.querySelector("#sound").addEventListener("click", () => { state.sound = !state.sound; setSound(state.sound); playTone("click"); render(); });
  app.querySelector("#cardInfo").addEventListener("click", () => showInfoCard({ title: "Kartensystem", text: "Literaturkarten stellen Fragen, Ereignisse verändern Ressourcen oder Weltlage, Entscheidungen haben mehrere vertretbare Wege." }));
  app.querySelector("#figureInfo").addEventListener("click", () => showInfoCard({ title: player.character.name, text: `${player.character.description}<br><br><strong>${player.character.ability}</strong>: ${player.character.abilityRule}` }));
  app.querySelector("#rulesInfo").addEventListener("click", () => showInfoCard({ title: "Regeln", text: "Würfle einmal pro Zug, bewege die Figur und löse das Feld aus. Ortsfelder können gekauft werden. Landet ein anderer Spieler dort, zahlt er eine kleine Abgabe. Nach 15 Runden gewinnt die höchste Literaturpunktzahl." }));
  app.querySelector("#support")?.addEventListener("click", () => supportPlayer(player));
}

async function takeTurn() {
  if (state.phase !== "TURN_START") return;
  const player = state.players[state.currentPlayer];
  if ((player.skipTurns || 0) > 0) {
    player.skipTurns -= 1;
    log(`${player.name} wartet diese Runde aus.`);
    return endTurn();
  }
  state.phase = "ROLL_DICE";
  state.lastRoll = null;
  render();
  const dieValue = rollDie();
  let steps = dieValue;
  if (player.character.id === "joseph-roth" && !player.firstMoveDone) steps += 2;
  player.firstMoveDone = true;
  playTone("dice");
  await animateDice(document.querySelector("#dice"), dieValue);
  state.lastRoll = dieValue;
  log(`${player.name} würfelt ${dieValue}${steps !== dieValue ? ` und bewegt sich mit Bonus ${steps} Felder` : ""}.`);
  await movePlayer(state, player, steps, render);
  resolveField(player);
}

function resolveField(player) {
  state.phase = "FIELD_EVENT";
  const field = state.board[player.position];
  if (field.type === "start") {
    applyEffects(player, { money: 2 });
    log(`${player.name} sammelt am Start 2 Geld.`);
    return endTurn();
  }
  if (field.type === "location" || field.type === "travel") return resolveProperty(player, field);
  if (field.type === "literature") return showQuiz(drawLiterature(field.era), player, endTurn);
  if (field.type === "event") return resolveEvent(player, field);
  if (field.type === "decision") return showDecision(drawDecision(field.era), player, endTurn);
  if (field.type === "tax") return resolveTax(player, field);
  if (field.type === "rest") {
    applyEffects(player, { contacts: 1 });
    log(`${player.name} nutzt ${field.name}: +1 Kontakt.`);
    return endTurn();
  }
  if (field.type === "penalty") {
    player.position = state.board.findIndex(item => item.id === "warteraum");
    player.skipTurns = 1;
    log(`${player.name} muss in den Warteraum und setzt eine Runde aus.`);
    return endTurn();
  }
  if (field.type === "final") {
    applyEffects(player, { literature: 3 });
    log(`${player.name} erreicht das Finale und bewahrt 3 Literaturpunkte.`);
    return endTurn();
  }
  endTurn();
}

function resolveProperty(player, field) {
  const owner = state.players.find(candidate => candidate.id === field.ownerId);
  if (!owner) return showPropertyPurchase(player, field);
  if (owner.id === player.id) {
    return showOwnedProperty(player, field);
  }
  const targetFee = calculateRent(owner, field);
  const fee = Math.min(targetFee, player.money);
  if (fee > 0) {
    applyEffects(player, { money: -fee });
    applyEffects(owner, { money: fee, literature: 1 });
    log(`${player.name} landet auf ${field.name} von ${owner.name} und zahlt ${fee} Miete. ${owner.name} erhält +1 Literatur.`);
  } else {
    applyEffects(owner, { literature: 1 });
    log(`${player.name} landet auf ${field.name}, hat aber kein Geld für die Abgabe. ${owner.name} erhält +1 Literatur.`);
  }
  endTurn();
}

function showOwnedProperty(player, field) {
  const canDevelop = field.type === "location" && ownsCompleteGroup(player, field) && (field.level || 0) < 4 && player.money >= 3;
  if (!canDevelop) {
    applyEffects(player, { literature: 1 });
    log(`${player.name} besucht das eigene Feld ${field.name}: +1 Literatur.`);
    return endTurn();
  }
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `<article class="modal-card"><button class="modal-close" data-close aria-label="Ausbau schließen">×</button>
    <div class="kicker">${field.group} · Eigenes Feld</div>
    <h2>${field.name}</h2>
    <p>Du besitzt die ganze Farbgruppe. Du kannst dieses Feld ausbauen. Jedes Haus erhöht die Miete.</p>
    <p><strong>Ausbaukosten:</strong> 3 Geld · <strong>Aktuelle Häuser:</strong> ${field.level || 0}/4 · <strong>Dein Geld:</strong> ${player.money}</p>
    <div class="modal-actions two">
      <button class="continue-btn" id="buildHouse">Haus bauen</button>
      <button class="skip-btn" id="skipBuild">Nicht bauen</button>
    </div>
  </article>`;
  document.body.appendChild(overlay);
  const onKey = event => {
    if (event.key === "Escape") close(false);
  };
  const close = build => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    if (build) {
      applyEffects(player, { money: -3, literature: 1 });
      field.level = (field.level || 0) + 1;
      log(`${player.name} baut ${field.name} aus. Miete steigt.`);
    } else {
      applyEffects(player, { literature: 1 });
      log(`${player.name} besucht das eigene Feld ${field.name}: +1 Literatur.`);
    }
    endTurn();
  };
  document.addEventListener("keydown", onKey);
  overlay.querySelector("[data-close]").addEventListener("click", () => close(false));
  overlay.querySelector("#buildHouse").addEventListener("click", () => close(true));
  overlay.querySelector("#skipBuild").addEventListener("click", () => close(false));
}

function showPropertyPurchase(player, field) {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  const canBuy = player.money >= field.price;
  const label = field.type === "travel" ? "Bahnhof kaufen" : "Ort kaufen";
  overlay.innerHTML = `<article class="modal-card"><button class="modal-close" data-close aria-label="Ort schließen">×</button>
    <div class="kicker">${field.group || field.era} · Kaufbares Feld</div>
    <h2>${field.name}</h2>
    <p>Dieses Feld ist noch frei. Du kannst es kaufen. Andere Spieler zahlen hier später Miete. Wenn du eine ganze Farbgruppe besitzt, steigt die Miete.</p>
    <p><strong>Preis:</strong> ${field.price} Geld · <strong>Miete:</strong> ${field.fee} Geld · <strong>Dein Geld:</strong> ${player.money}</p>
    <div class="modal-actions two">
      <button class="continue-btn" id="buyLocation" ${canBuy ? "" : "disabled"}>${canBuy ? label : "Zu wenig Geld"}</button>
      <button class="skip-btn" id="documentOnly">Nur dokumentieren</button>
    </div>
  </article>`;
  document.body.appendChild(overlay);
  const onKey = event => {
    if (event.key === "Escape") close(() => endTurn());
  };
  const close = callback => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    callback();
  };
  document.addEventListener("keydown", onKey);
  overlay.querySelector("[data-close]").addEventListener("click", () => close(() => endTurn()));
  overlay.querySelector("#documentOnly").addEventListener("click", () => close(() => {
    collectLocation(player, field, false);
    endTurn();
  }));
  overlay.querySelector("#buyLocation").addEventListener("click", () => {
    if (!canBuy) return;
    close(() => {
      applyEffects(player, { money: -field.price });
      field.ownerId = player.id;
      if (!player.ownedLocations) player.ownedLocations = [];
      if (!player.ownedLocations.includes(field.id)) player.ownedLocations.push(field.id);
      collectLocation(player, field, true);
      render();
      endTurn();
    });
  });
}

function collectLocation(player, field, bought) {
  if (!player.collectedLocations.includes(field.id)) {
    player.collectedLocations.push(field.id);
    applyEffects(player, { literature: bought ? 2 : 1 });
    const completed = Object.values(locationSets).find(set => set.every(id => player.collectedLocations.includes(id)) && set.includes(field.id));
    if (completed) applyEffects(player, { literature: 5 });
    log(`${player.name} ${bought ? "kauft" : "dokumentiert"} ${field.name}. ${completed ? "Ein Ortsset ist vollständig: +5 Literatur." : bought ? "+2 Literatur." : "+1 Literatur."}`);
  } else {
    applyEffects(player, { contacts: 1 });
    log(`${field.name} ist bekannt. ${player.name} gewinnt einen Kontakt.`);
  }
}

function calculateRent(owner, field) {
  const group = field.group ? state.board.filter(item => item.group === field.group && (item.type === "location" || item.type === "travel")) : [];
  const ownsGroup = group.length > 0 && group.every(item => item.ownerId === owner.id);
  if (field.type === "travel") {
    const stations = state.board.filter(item => item.type === "travel" && item.ownerId === owner.id).length;
    return Math.max(1, stations);
  }
  const base = ownsGroup ? (field.fee || 1) * 2 : (field.fee || 1);
  return base + (field.level || 0) * 2;
}

function ownsCompleteGroup(player, field) {
  const group = field.group ? state.board.filter(item => item.group === field.group && item.type === "location") : [];
  return group.length > 0 && group.every(item => item.ownerId === player.id);
}

function resolveTax(player, field) {
  const amount = Math.min(field.fee || 2, player.money);
  applyEffects(player, { money: -amount });
  log(`${player.name} zahlt ${amount} Geld auf ${field.name}.`);
  endTurn();
}

function resolveEvent(player, field) {
  const card = drawEvent(field.era);
  let effects = { ...card.effects };
  if (player.character.id === "klaus-mann" && card.tag === "publication") effects.literature = (effects.literature || 0) + 2;
  if (player.character.id === "hannah-arendt" && (effects.safety || effects.documents || 0) < 0) effects.contacts = (effects.contacts || 0) + 1;
  applyEffects(player, effects);
  if (card.worldEvent && !state.activeEvents.includes(card.worldEvent)) state.activeEvents.push(card.worldEvent);
  log(`${card.title}: ${effectText(effects)}.`);
  showInfoCard({ ...card, text: `${card.text}<br><br><strong>${effectText(effects)}</strong><br>${card.context}` }, endTurn);
}

function resolveTravel(player, field) {
  let costMoney = player.character.id === "anna-seghers" && player.documents > 0 ? 0 : 1;
  let costDocs = state.activeEvents.includes("pressure") || state.activeEvents.includes("marseilleDanger") ? 1 : 0;
  if (player.character.id === "heinrich-mann") {
    if (costDocs > 0) costDocs -= 1;
    else costMoney = Math.max(0, costMoney - 1);
  }
  if (player.money >= costMoney && player.documents >= costDocs) {
    applyEffects(player, { money: -costMoney, documents: -costDocs, literature: 1 });
    log(`${player.name} bewältigt ${field.name}: ${effectText({ money: -costMoney, documents: -costDocs, literature: 1 })}.`);
  } else {
    applyEffects(player, { contacts: 1 });
    log(`${player.name} kann ${field.name} nicht vollständig vorbereiten und sucht Unterstützung: +1 Kontakt.`);
  }
  endTurn();
}

function endTurn() {
  state.phase = "TURN_END";
  const player = state.players[state.currentPlayer];
  if (player.usedAbilityRound === -1) player.usedAbilityRound = state.round;
  state.currentPlayer += 1;
  if (state.currentPlayer >= state.players.length) {
    state.currentPlayer = 0;
    state.round += 1;
    state.players.forEach(p => { if (p.character.id === "erika-mann") p.usedAbilityRound = 0; });
  }
  if (state.round > state.maxRounds) {
    state.phase = "GAME_OVER";
    clearSave();
  } else {
    state.phase = "TURN_START";
  }
  saveGame(state);
  render();
}

function supportPlayer(player) {
  if (state.phase !== "TURN_START" || player.character.id !== "varian-fry") return;
  if (player.usedAbilityRound === state.round) {
    log("Varian Frys Netzwerk wurde in dieser Runde bereits genutzt.");
    return render();
  }
  const target = state.players.find(p => p.id !== player.id);
  if (!target) return;
  if (player.documents > 0) {
    applyEffects(player, { documents: -1, helped: 1 });
    applyEffects(target, { documents: 1 });
    log(`${player.name} unterstützt ${target.name} mit einem Dokument.`);
  } else if (player.contacts > 0) {
    applyEffects(player, { contacts: -1, helped: 1 });
    applyEffects(target, { contacts: 1 });
    log(`${player.name} unterstützt ${target.name} mit einem Kontakt.`);
  } else {
    log("Für Unterstützung fehlt gerade eine passende Ressource.");
  }
  player.usedAbilityRound = state.round;
  render();
}

function renderGameOver() {
  const ranking = [...state.players].sort((a, b) => b.literature - a.literature || b.correct - a.correct);
  app.innerHTML = `<main class="game-over"><span class="stamp">Die Reise endet</span><h1>Ergebnis</h1>
    <div class="chapter-grid">${ranking.map((p, i) => `<article><strong>${["Gold", "Silber", "Bronze", "Platz 4"][i]}</strong><span>${p.name} - ${p.literature} Literaturpunkte</span><small>${p.character.name} · ${p.correct}/${p.answered} Fragen · ${p.documents} Dokumente · ${p.helped} Hilfen · ${p.collectedLocations.length} Orte</small></article>`).join("")}</div>
    <button class="primary-btn" id="again">Noch einmal</button> <a class="ghost-btn" href="index.html">Hauptmenü</a></main>`;
  app.querySelector("#again").addEventListener("click", () => { state.phase = "SETUP"; setup.selected = {}; render(); });
}

render();
