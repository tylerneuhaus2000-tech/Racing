# GT3 Release Gates

## Gate A: Technical Hygiene
- Inline GT3 scripts pass syntax check.
- Track JSON files parse successfully.
- No missing required track keys.
- No severe track topology warnings left unresolved.

## Gate B: Gameplay Integrity
- Car can complete a clean lap on each target track.
- Lap timing and leaderboard writes are consistent.
- AI can finish race without frequent deadlocks.
- Pit/penalty flow does not soft-lock race progression.

## Gate C: Performance
- Stable frame pacing under race load.
- No major memory spikes during menu-race-menu loop.
- Asset loading does not produce critical timeout failures.
- Core Web Vitals stay within target for landing/start flow.
- First interactive race input is within target startup latency.

## Gate D: UX
- Input works for keyboard/controller/touch targets.
- HUD values remain coherent in all race states.
- Shop/account flows fail gracefully when network is unavailable.
- Mobile orientation and touch ergonomics are validated.
- Safari-specific behavior is validated (audio/input/fullscreen transitions).

## Gate E: Monetization Safety
- Rewarded flow cannot infinitely self-grant without limits.
- Premium/no-ads behavior works as intended.
- Store purchase callbacks fail safely with clear user feedback.

## Gate F: Platform Ready
- Browser matrix checks pass (Chrome, Safari, Edge, Firefox).
- CDN/cache invalidation and rollback plan are documented and tested.
- Staging-to-production rollout checklist is green.
