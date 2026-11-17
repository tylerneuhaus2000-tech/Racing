const positions = [
  [11,11],[10,11],[9,11],[8,11],[7,11],[6,11],[5,11],[4,11],[3,11],[2,11],[1,11],
  [1,10],[1,9],[1,8],[1,7],[1,6],[1,5],[1,4],[1,3],[1,2],
  [1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[7,1],[8,1],[9,1],[10,1],[11,1],
  [11,2],[11,3],[11,4],[11,5],[11,6],[11,7],[11,8],[11,9],[11,10]
];

export function renderBoard(container, state) {
  container.innerHTML = "";
  const board = document.createElement("section");
  board.className = "board";
  board.innerHTML = `
    <div class="center-map">
      <div class="board-title"><span>Exil Edition</span><h2>Literatur im Exil</h2><p>Kaufen · Miete · Karten · Fluchtwege</p></div>
      <div class="deck deck-literature">Literatur</div>
      <div class="deck deck-event">Ereignis</div>
    </div>`;
  state.board.forEach((field, index) => {
    const typeLabels = { start: "Start", location: "Ort", literature: "Karte", event: "Ereignis", decision: "Chance", travel: "Bahnhof", tax: "Abgabe", rest: "Frei", penalty: "Warten", final: "Übersee" };
    const tile = document.createElement("article");
    const owner = state.players.find(player => player.id === field.ownerId);
    tile.className = "field";
    if ([0, 10, 20, 30].includes(index)) tile.classList.add("corner-field");
    if (state.players[state.currentPlayer]?.position === index) tile.classList.add("current-field");
    if (owner) tile.classList.add("owned-field");
    tile.dataset.era = field.era;
    tile.dataset.type = field.type;
    tile.style.gridColumn = positions[index][0];
    tile.style.gridRow = positions[index][1];
    tile.style.setProperty("--field-strip", field.groupColor || "#c4b496");
    if (owner) tile.style.setProperty("--owner", owner.character.color);
    const tokens = state.players.filter(p => p.position === index).map((p, tokenIndex) => `
      <span class="token token-${tokenIndex} ${p.id === state.players[state.currentPlayer]?.id ? "is-current" : ""}" style="--piece:${p.character.color}" title="${p.name} - ${p.character.name}">
        <span class="token-shadow"></span>
        <span class="token-head">${p.character.initials.slice(0, 1)}</span>
        <span class="token-body"></span>
        <span class="token-base"></span>
      </span>`).join("");
    tile.innerHTML = `
      <small>${typeLabels[field.type] || field.type}${field.price ? ` · ${field.price}G` : ""}</small>
      <h3>${field.name}</h3>
      ${field.group ? `<b class="group-label">${field.group}</b>` : ""}
      ${owner ? `<div class="owner-badge">${owner.character.initials}</div>` : ""}
      ${field.level ? `<div class="houses">${Array.from({ length: field.level }, () => "<i></i>").join("")}</div>` : ""}
      <div class="tokens">${tokens}</div>`;
    if (state.debug) tile.addEventListener("click", () => { state.players[state.currentPlayer].position = index; state.render(); });
    board.appendChild(tile);
  });
  container.appendChild(board);
}
