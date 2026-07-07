# GT3 Web Racer Specialization Plan

## Vision
Build the best browser GT3 racer by winning on three axes:
- Driving feel
- Performance/stability
- Fair progression and long-term retention

## Product Pillars
- Instant access: fast startup and no install friction.
- Competitive integrity: skill-first outcomes and transparent systems.
- Long-session quality: stable performance and low input latency.

## What "Best Web Racer" Means (Measurable)
- Startup to drivable target under strict threshold on desktop and mobile.
- Stable race FPS in target browser/device matrix.
- Low severe bug rate in race-critical flows.
- Positive retention trend after first-session improvements.

## Browser Matrix (Priority)
- Desktop: Chrome, Edge, Firefox, Safari.
- Mobile: Android Chrome, iOS Safari.
- Input matrix: keyboard, controller, touch.

## Core Quality Roadmap

### Track Quality
- Enforce track schema validation before release.
- Add closure/continuity checks and warning thresholds.
- Add spawn safety checks and boundary sanity checks.

### Physics and Handling
- Lock baseline handling profile per car class.
- Add deterministic replay checks for regression detection.
- Maintain one balancing ledger for every handling change.

### Performance
- Create frame-time budget per subsystem (render, physics, AI, UI).
- Add quality presets with adaptive fallback.
- Track memory over long race sessions.

### Reliability
- Harden asset loading with timeout and fallback states.
- Ensure race can always be completed or safely restarted.
- Add explicit error-state UX for network/auth/store failures.

## Live Ops (Web)
- Weekly event pulse with clear rewards.
- Monthly quality patch cadence.
- A/B test only non-core economy variables.

## Monetization Guardrails
- Rewarded bonuses are optional and rate-limited.
- No pay-to-win gate for race competitiveness.
- Ads disabled in critical race moments.

## 30-Day Execution Order
- Week 1: browser matrix baseline + perf instrumentation + bug triage.
- Week 2: track-quality automation + race-critical smoke tests.
- Week 3: input latency and touch/controller polish + stability pass.
- Week 4: retention loop polish + rollout/canary discipline.

## Definition of Success
- GT3 is consistently playable, competitive, and smooth in all priority browsers.
- New content can ship without breaking core race quality.
- Players perceive GT3 as the most reliable web racing experience in its class.
