let enabled = false;

export function setSound(value) {
  enabled = Boolean(value);
}

export function playTone(kind = "click") {
  if (!enabled) return;
  try {
    const context = new AudioContext();
    const osc = context.createOscillator();
    const gain = context.createGain();
    const freq = { click: 320, dice: 180, card: 260, stamp: 120 }[kind] || 220;
    osc.frequency.value = freq;
    gain.gain.value = 0.035;
    osc.connect(gain).connect(context.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
    osc.stop(context.currentTime + 0.13);
  } catch {}
}
