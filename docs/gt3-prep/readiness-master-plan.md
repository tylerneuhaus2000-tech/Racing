# GT3 Preparation Master Plan

## Goal
Prepare GT3 to become a top-tier web racer with quality first: stable handling, clean tracks, low input latency, predictable performance, and release-grade live operations.

## Phase 1: Stabilize Core GT3 Loop (Now)
- Freeze feature creep for systems that affect race reliability.
- Keep one source-of-truth setup for physics constants and car balance.
- Run preflight audit before every release candidate.
- Build a regression checklist for lap timing, collisions, pit flow, and UI state transitions.

## Phase 2: Web Technical Excellence
- Browser compatibility matrix (Chrome, Safari, Edge, Firefox) across desktop and mobile.
- Input quality matrix:
  - Keyboard
  - Controller/Gamepad API
  - Touch controls (mobile/tablet)
- Asset delivery optimization:
  - Track and model payload budgets
  - Lazy loading and caching policy
  - Fast cold-start and warm-start targets

## Phase 3: Performance and Netcode Readiness
- One polished track and two polished cars as quality baseline.
- One reliable race mode baseline (time trial + quick race).
- Performance targets:
  - Desktop mainstream hardware: stable 60 FPS.
  - Mobile mid-tier: stable 45-60 FPS with adaptive quality.
- Network targets:
  - Graceful degradation on high latency.
  - No hard locks on reconnect/failover states.

## Phase 4: Web Productization
- PWA readiness plan (installable experience where useful).
- Analytics and diagnostics for retention and crash tracking.
- CDN and caching strategy with safe cache-busting.
- Rollout strategy:
  - Staging URL
  - Canary cohort
  - Full rollout with rollback switch

## Phase 5: Live Ops Foundation
- Monthly update cadence with weekly micro-events.
- Patch notes generated from git history.
- Event framework that does not damage progression fairness.

## Working Agreements
- Every change must pass preflight + manual smoke checks.
- No new mode before core race loop scorecard is green.
- Monetization experiments must not reduce baseline fun in first 20 minutes.

## Definition of Ready (Before Major Web Push)
- Track quality checks pass with no blocking errors.
- Core gameplay smoke tests pass on at least 5 browser/device combinations.
- Crash rate and severe bug backlog below agreed threshold.
- Monitoring and rollback plan documented and tested.
