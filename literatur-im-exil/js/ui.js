export function clampText(value, fallback = "") {
  return String(value ?? fallback);
}
