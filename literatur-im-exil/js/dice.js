export function rollDie() {
  return 1 + Math.floor(Math.random() * 6);
}

export async function animateDice(element, finalValue) {
  element.classList.add("rolling");
  element.classList.remove("revealed");
  const faces = ["1", "2", "3", "4", "5", "6"];
  for (let i = 0; i < 22; i += 1) {
    element.textContent = faces[Math.floor(Math.random() * faces.length)];
    await new Promise(resolve => setTimeout(resolve, 62 + i * 4));
  }
  element.classList.remove("rolling");
  element.classList.add("revealed");
  element.textContent = faces[finalValue - 1];
  await new Promise(resolve => setTimeout(resolve, 1150));
}
