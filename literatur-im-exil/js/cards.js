import { literatureCards } from "../data/questions.js";
import { eventCards } from "../data/events.js";
import { decisionCards } from "../data/decisions.js";
import { applyEffects, effectText } from "./resources.js";
import { playTone } from "./audio.js";

const pick = list => list[Math.floor(Math.random() * list.length)] || null;
const byEra = (list, era) => list.filter(card => card.era === era || card.era === "any");

function wireModalExit(overlay, onExit) {
  const finish = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    onExit?.();
  };
  const onKey = event => {
    if (event.key === "Escape") finish();
  };
  overlay.querySelector("[data-close]")?.addEventListener("click", finish);
  document.addEventListener("keydown", onKey);
  return finish;
}

export function drawLiterature(era) {
  const pools = {
    deutschland: "Februar 33",
    flucht: "Februar 33",
    sanary: "Wenn die Sonne untergeht",
    marseille: "Marseille 1940"
  };
  return pick(literatureCards.filter(card => card.book === pools[era])) || pick(literatureCards);
}

export function drawEvent(era) {
  return pick(byEra(eventCards, era)) || pick(eventCards);
}

export function drawDecision(era) {
  return pick(byEra(decisionCards, era)) || pick(decisionCards);
}

export function showInfoCard(card, onContinue) {
  playTone("card");
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `<article class="modal-card"><button class="modal-close" data-close aria-label="Karte schließen">×</button><div class="kicker">${card.book || card.era || "Archiv"}</div><h2>${card.title || "Karte"}</h2><p>${card.text || card.explanation || ""}</p>${card.needsVerification ? `<span class="needs-verification">Quellenprüfung empfohlen</span>` : ""}<div class="modal-actions"><button class="continue-btn">Weiter</button></div></article>`;
  document.body.appendChild(overlay);
  const finish = wireModalExit(overlay, onContinue);
  overlay.querySelector(".continue-btn").addEventListener("click", finish);
}

export function showQuiz(card, player, onDone) {
  playTone("card");
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `<article class="modal-card"><button class="modal-close" data-close aria-label="Karte schließen">×</button><div class="kicker">${card.book} · Literaturfrage</div><h2>${card.question}</h2><div class="answer-list">${card.answers.map((answer, i) => `<button data-index="${i}">${answer}</button>`).join("")}</div><p class="effect-line"></p>${card.needsVerification ? `<span class="needs-verification">Quellenprüfung empfohlen</span>` : ""}<div class="modal-actions"></div></article>`;
  document.body.appendChild(overlay);
  const finish = wireModalExit(overlay, onDone);
  let usedRetry = false;
  const buttons = [...overlay.querySelectorAll("[data-index]")];
  const line = overlay.querySelector(".effect-line");
  buttons.forEach(button => button.addEventListener("click", () => {
    const index = Number(button.dataset.index);
    const correct = index === card.correctAnswer;
    if (!correct && player.character.id === "erika-mann" && !usedRetry && player.usedAbilityRound === 0) {
      usedRetry = true;
      player.usedAbilityRound = -1;
      line.textContent = "Erika Manns Fähigkeit: Du darfst diese Antwort einmal überdenken.";
      button.classList.add("wrong");
      return;
    }
    player.answered += 1;
    buttons.forEach(b => b.disabled = true);
    buttons[card.correctAnswer].classList.add("correct");
    if (!correct) button.classList.add("wrong");
    if (correct) {
      const bonus = player.character.id === "thomas-mann" ? 1 : 0;
      applyEffects(player, { literature: card.rewards.literature + bonus });
      player.correct += 1;
    }
    line.innerHTML = `${correct ? "Richtig." : "Nicht richtig."} ${card.explanation}<br><strong>${correct ? effectText({ literature: card.rewards.literature + (player.character.id === "thomas-mann" ? 1 : 0) }) : "Keine Punkte"}</strong>`;
    const next = document.createElement("button");
    next.className = "continue-btn";
    next.textContent = "Weiter zum nächsten Zug";
    next.addEventListener("click", finish);
    overlay.querySelector(".modal-actions").appendChild(next);
  }));
}

export function showDecision(card, player, onDone) {
  playTone("card");
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `<article class="modal-card"><button class="modal-close" data-close aria-label="Karte schließen">×</button><div class="kicker">${card.era} · Entscheidung</div><h2>${card.title}</h2><p>${card.text}</p><div class="decision-list">${card.options.map((option, i) => `<button data-index="${i}"><strong>${option.label}</strong><br><span>${effectText(option.effects)}</span></button>`).join("")}</div><p class="effect-line"></p><div class="modal-actions"></div></article>`;
  document.body.appendChild(overlay);
  const finish = wireModalExit(overlay, onDone);
  overlay.querySelectorAll("[data-index]").forEach(button => button.addEventListener("click", () => {
    const option = card.options[Number(button.dataset.index)];
    applyEffects(player, option.effects);
    overlay.querySelector(".decision-list").innerHTML = "";
    overlay.querySelector(".effect-line").innerHTML = `${card.historicalContext}<br><strong>${effectText(option.effects)}</strong>`;
    const next = document.createElement("button");
    next.className = "continue-btn";
    next.textContent = "Weiter zum nächsten Zug";
    next.addEventListener("click", finish);
    overlay.querySelector(".modal-actions").appendChild(next);
  }));
}
