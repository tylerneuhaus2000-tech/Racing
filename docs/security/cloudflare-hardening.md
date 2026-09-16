# Cloudflare Hardening for grid-line.de

This is the safe production hardening checklist for `grid-line.de`. It is designed for the Cloudflare Free plan first, because the zone currently shows `free` in the dashboard.

Do not use production DDoS/load tests as a validation method. Validate with Cloudflare analytics, security events, cache hit ratio, and controlled local/staging tests.

## What To Enable First

### 1. Bot Fight Mode
Dashboard path:

```text
Security > Settings > Bot traffic > Bot Fight Mode > On
```

Reason: It is the free Cloudflare bot mitigation layer. Watch Security Events after enabling it, because it protects the whole domain and is not adjustable per path on the Free plan.

Rollback:

```text
Security > Settings > Bot traffic > Bot Fight Mode > Off
```

### 2. Browser Integrity Check
Dashboard path:

```text
Security > Settings > Browser Integrity Check > On
```

Reason: Low-risk filter for obvious malformed or abusive browser signatures.

### 3. Security Level
Dashboard path:

```text
Security > Settings > Security Level
```

Recommended:

```text
Medium normally
High during suspicious spikes
I'm Under Attack only during an active attack
```

## WAF Custom Rules

Dashboard path:

```text
Security > Security rules > Create rule > Custom rules
```

Create these in order.

### Rule 1: Block Non-Static Methods

Action:

```text
Block
```

Expression:

```text
(http.request.method ne "GET" and http.request.method ne "HEAD" and http.request.method ne "OPTIONS")
```

Reason: `grid-line.de` is a static public game site. It should not receive POST/PUT/PATCH/DELETE requests.

### Rule 2: Block Common Scanner Paths

Action:

```text
Block
```

Expression:

```text
(http.request.uri.path eq "/wp-login.php" or http.request.uri.path eq "/xmlrpc.php" or http.request.uri.path eq "/.env" or http.request.uri.path contains "/.git" or http.request.uri.path contains "/phpmyadmin" or http.request.uri.path contains "/wp-admin" or http.request.uri.path contains "/administrator")
```

Reason: These paths are common automated scanner targets and are unrelated to Gridline.

### Rule 3: Managed Challenge Obvious Automation

Action:

```text
Managed Challenge
```

Expression:

```text
(not cf.client.bot and (http.user_agent eq "" or http.user_agent contains "python-requests" or http.user_agent contains "Go-http-client" or http.user_agent contains "sqlmap" or http.user_agent contains "masscan" or http.user_agent contains "nikto"))
```

Reason: Challenge obvious automation while allowing verified bots.

## Rate Limiting

Dashboard path:

```text
Security > Security rules > Create rule > Rate limiting rules
```

Free plan usually gives one rate limiting rule. Use one broad, gentle rule first.

Name:

```text
Gridline broad anti-abuse limit
```

Expression:

```text
(http.request.uri.path starts_with "/")
```

Characteristics:

```text
IP
```

Limit:

```text
150 requests / 10 seconds
```

Action:

```text
Managed Challenge
```

Duration:

```text
10 seconds
```

Notes:
- If Cloudflare Free only allows `Block`, use `Block` but raise the threshold to `250 requests / 10 seconds`.
- If legitimate players get challenged while loading heavy assets, increase the threshold.
- Do not set a tiny threshold; one game load can legitimately request many assets.

## Cache Rules

Dashboard path:

```text
Rules > Cache Rules > Create rule
```

### Rule 1: Cache Game Assets

Expression:

```text
(http.request.uri.path starts_with "/assets/")
```

Settings:

```text
Eligible for cache
Edge TTL: Ignore origin, 7 days
Browser TTL: Override origin, 1 day
Cache deception armor: On, if shown
```

Reason: Track/model/audio assets are the heaviest part of the game. They should be served from Cloudflare cache.

### Rule 2: Cache HTML Briefly

Expression:

```text
(http.request.uri.path eq "/" or http.request.uri.path ends_with ".html")
```

Settings:

```text
Eligible for cache
Edge TTL: Ignore origin, 10 minutes
Browser TTL: Override origin, 5 minutes
```

Reason: This reduces load while keeping deploy changes visible quickly.

## Emergency Switch

Only if the site is actively under attack:

```text
Security > Settings > Security Level > I'm Under Attack
```

Turn it back to `Medium` after the spike. Do not leave it on forever, because it can annoy real players.

## Validation

After changing rules:

```bash
npm run audit:security
```

Then check Cloudflare:

```text
Security > Analytics > Events
Analytics > HTTP Traffic
Cache > Analytics
```

Target state:
- Static assets show Cloudflare cache hits.
- Scanner paths are blocked.
- Legit players can still load and play.
- Rate limiting does not fire for normal gameplay.

## Sources
- Cloudflare custom rules: https://developers.cloudflare.com/waf/custom-rules/
- Cloudflare rate limiting rules: https://developers.cloudflare.com/waf/rate-limiting-rules/
- Cloudflare rate limiting dashboard setup: https://developers.cloudflare.com/waf/rate-limiting-rules/create-zone-dashboard/
- Cloudflare Bot Fight Mode: https://developers.cloudflare.com/bots/get-started/bot-fight-mode/
- Cloudflare Cache Rules: https://developers.cloudflare.com/cache/how-to/cache-rules/
- Cloudflare Cache Rule settings: https://developers.cloudflare.com/cache/how-to/cache-rules/settings/
