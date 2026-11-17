export async function movePlayer(state, player, steps, render) {
  state.phase = "MOVING";
  for (let i = 0; i < steps; i += 1) {
    player.position = (player.position + 1) % state.board.length;
    if (player.position === 0 && i < steps - 1) {
      player.money = (player.money || 0) + 2;
      state.history.unshift(`${player.name} zieht über Start und erhält 2 Geld.`);
      state.history = state.history.slice(0, 12);
    }
    render();
    await new Promise(resolve => setTimeout(resolve, 190));
  }
}
