export function createPlayer(id, name, character) {
  return {
    id,
    name: name || `Spieler ${id + 1}`,
    character,
    position: 0,
    money: 20,
    documents: 1,
    contacts: 1,
    literature: 0,
    safety: 2,
    helped: 0,
    correct: 0,
    answered: 0,
    collectedLocations: [],
    ownedLocations: [],
    inventory: [],
    usedAbilityRound: 0,
    firstMoveDone: false,
    skipTurns: 0
  };
}

export function characterInitials(character) {
  return character?.initials || "??";
}
