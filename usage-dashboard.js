#!/usr/bin/env node
/**
 * usage-dashboard.js
 *
 * Stellt eine optionale, explizit bereitgestellte lokale Usage-Quelle bereit:
 *
 *   node usage-dashboard.js            -> HTTP-Server mit Dashboard + JSON-API
 *   node usage-dashboard.js --json     -> gibt den aufbereiteten Feed einmalig als JSON aus
 *   node usage-dashboard.js --out FILE -> schreibt den Feed einmalig in FILE (fuer Cron)
 *
 * Endpunkte im Server-Modus:
 *   GET /            -> HTML-Dashboard
 *   GET /api/usage   -> aufbereiteter JSON-Feed
 *
 * Optionen:
 *   --port N     Port (Default 4317, oder $PORT)
 *   --ttl S      Cache-Dauer der lokalen Usage-Abfrage in Sekunden (Default 1800)
 *
 * Keine externen Dependencies und kein API-Key. Ohne GRIDLINE_USAGE_FEED bleibt
 * die Usage transparent nicht verfuegbar.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

// ---- CLI-Argumente ---------------------------------------------------------
const argv = process.argv.slice(2);
function flag(name) { return argv.includes(name); }
function opt(name, def) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}

const PORT = parseInt(opt('--port', process.env.PORT || '4317'), 10);
const TTL_MS = parseInt(opt('--ttl', '1800'), 10) * 1000;
const ROOT = __dirname;
const USAGE_FEED = process.env.GRIDLINE_USAGE_FEED || path.join(ROOT, 'assets', 'gridline-usage.json');

// Die Datei muss selbst eine validierte Quelle mit available:true und totals.tokens
// liefern. Das Dashboard ermittelt keine Preise und liest keine Zugangsdaten.
// ---- Explizite lokale Quelle lesen ----------------------------------------
function unavailable(reason) {
  return {
    available: false,
    generatedAt: new Date().toISOString(),
    checkedAt: new Date().toISOString(),
    source: null,
    reason,
    totals: { cost: null, tokens: null, months: 0 },
    inputTokens: null,
    outputTokens: null,
    currentMonth: null,
    months: [],
  };
}

function readUsageFeed() {
  if (!fs.existsSync(USAGE_FEED)) {
    return unavailable('Keine explizite GRIDLINE_USAGE_FEED-Datei gefunden.');
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(USAGE_FEED, 'utf8'));
  } catch (error) {
    return unavailable(`Usage-Feed konnte nicht gelesen werden: ${error.message}`);
  }
  const tokens = Number(raw?.totals?.tokens ?? raw?.totalTokens);
  const cost = Number(raw?.totals?.cost ?? raw?.cost);
  if (raw?.available !== true || !Number.isFinite(tokens) || tokens < 0) {
    return unavailable(raw?.reason || 'Usage-Feed enthaelt keine validierten Token-Daten.');
  }
  return {
    available: true,
    generatedAt: raw.generatedAt || new Date().toISOString(),
    checkedAt: new Date().toISOString(),
    source: raw.source || 'Explizite lokale Usage-JSON',
    reason: 'Validierte lokale Usage-Quelle gelesen.',
    totals: { cost: Number.isFinite(cost) && cost >= 0 ? cost : null, tokens, months: Number(raw?.totals?.months || 0) },
    inputTokens: Number.isFinite(Number(raw.inputTokens)) ? Number(raw.inputTokens) : null,
    outputTokens: Number.isFinite(Number(raw.outputTokens)) ? Number(raw.outputTokens) : null,
    currentMonth: raw.currentMonth || null,
    months: Array.isArray(raw.months) ? raw.months : [],
  };
}

// ---- einfacher Cache -------------------------------------------------------
let cache = { at: 0, data: null, error: null };

async function getFeed(force) {
  if (!force && cache.data && (Date.now() - cache.at) < TTL_MS) {
    return cache.data;
  }
  const feed = readUsageFeed();
  cache = { at: Date.now(), data: feed, error: null };
  return feed;
}

// ---- Dashboard-HTML --------------------------------------------------------
const DASHBOARD_HTML = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GRIDLINE Usage</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    background: #0f1115; color: #e7e9ee; padding: 2rem clamp(1rem, 4vw, 3rem); }
  h1 { font-size: 1.4rem; margin: 0 0 .25rem; }
  .sub { color: #8b90a0; font-size: .85rem; margin-bottom: 1.5rem; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem; margin-bottom: 2rem; }
  .card { background: #171a21; border: 1px solid #23262f; border-radius: 12px; padding: 1rem 1.2rem; }
  .card .k { color: #8b90a0; font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; }
  .card .v { font-size: 1.6rem; font-weight: 650; margin-top: .3rem; }
  .card .v.cost { color: #7ee0a8; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: right; padding: .55rem .7rem; border-bottom: 1px solid #23262f; white-space: nowrap; }
  th:first-child, td:first-child { text-align: left; }
  th { color: #8b90a0; font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; }
  tr:hover td { background: #14171d; }
  .tokens { color: #9aa0b0; }
  .cost { color: #7ee0a8; }
  .agents { color: #6f7590; font-size: .78rem; }
  .wrap { overflow-x: auto; border: 1px solid #23262f; border-radius: 12px; }
  .err { color: #ff8a8a; background: #2a1416; border: 1px solid #542; padding: 1rem; border-radius: 12px; }
  footer { margin-top: 1.5rem; color: #6f7590; font-size: .78rem; }
</style>
</head>
<body>
  <h1>GRIDLINE Usage</h1>
  <div class="sub" id="sub">lade…</div>
  <div id="content"></div>
  <footer>Quelle: explizite lokale Usage-JSON, falls vorhanden. Auto-Refresh alle 30&nbsp;min; keine Werte werden geschaetzt.</footer>
<script>
const fmtN = (n) => Number.isFinite(Number(n)) ? new Intl.NumberFormat('de-DE').format(Number(n)) : 'Nicht verfuegbar';
const fmtT = (n) => !Number.isFinite(Number(n)) ? 'Nicht verfuegbar' : n >= 1e9 ? (n/1e9).toFixed(2)+' B' : n >= 1e6 ? (n/1e6).toFixed(1)+' M' : fmtN(n);
const fmt$ = (n) => Number.isFinite(Number(n)) ? '$' + new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(Number(n)) : 'Nicht verfuegbar';

async function load() {
  try {
    const r = await fetch('/api/usage');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    render(d);
  } catch (e) {
    document.getElementById('content').innerHTML =
      '<div class="err">Fehler beim Laden: ' + e.message + '</div>';
    document.getElementById('sub').textContent = '';
  }
}

function render(d) {
  const cur = d.currentMonth;
  document.getElementById('sub').textContent =
    'Stand: ' + new Date(d.generatedAt).toLocaleString('de-DE') + ' · ' + d.totals.months + ' Monate';

  let cards = ''
    + card('Gesamtkosten', fmt$(d.totals.cost), true)
    + card('Gesamt-Tokens', fmtT(d.totals.tokens))
    + card('Aktueller Monat', cur ? fmt$(cur.cost) : '–', true)
    + card('Tokens akt. Monat', cur ? fmtT(cur.totalTokens) : '–');

  let rows = d.months.slice().reverse().map(m =>
    '<tr><td>' + m.period + '<div class="agents">' + (m.agents.join(', ') || '') + '</div></td>'
    + '<td class="tokens">' + fmtT(m.inputTokens) + '</td>'
    + '<td class="tokens">' + fmtT(m.outputTokens) + '</td>'
    + '<td class="tokens">' + fmtT(m.cacheReadTokens) + '</td>'
    + '<td class="tokens">' + fmtT(m.totalTokens) + '</td>'
    + '<td class="cost">' + fmt$(m.cost) + '</td></tr>'
  ).join('');

  document.getElementById('content').innerHTML =
    '<div class="cards">' + cards + '</div>'
    + '<div class="wrap"><table><thead><tr>'
    + '<th>Monat</th><th>Input</th><th>Output</th><th>Cache Read</th><th>Total</th><th>Kosten</th>'
    + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function card(k, v, cost) {
  return '<div class="card"><div class="k">' + k + '</div><div class="v' + (cost ? ' cost':'') + '">' + v + '</div></div>';
}

load();
setInterval(load, 30 * 60 * 1000);
</script>
</body>
</html>`;

// ---- Modi ------------------------------------------------------------------
async function main() {
  // Einmal-Modi fuer Cron / Pipeline
  if (flag('--json') || flag('--out')) {
    const feed = await getFeed(true);
    const text = JSON.stringify(feed, null, 2);
    const outFile = opt('--out', null);
    if (outFile) {
      fs.writeFileSync(outFile, text);
      console.error(`Feed geschrieben nach ${outFile} (${feed.months.length} Monate, $${feed.totals.cost}).`);
    } else {
      process.stdout.write(text + '\n');
    }
    return;
  }

  // Server-Modus
  const server = http.createServer(async (req, res) => {
    const url = (req.url || '/').split('?')[0];
    if (url === '/api/usage') {
      try {
        const feed = await getFeed(false);
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
        });
        res.end(JSON.stringify(feed));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(DASHBOARD_HTML);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });

  server.listen(PORT, () => {
    console.error(`Usage-Dashboard laeuft auf http://localhost:${PORT}  (API: /api/usage)`);
    console.error(`ccusage-Cache: ${TTL_MS / 1000}s`);
  });
}

main().catch((e) => {
  console.error('Fehler:', e.message);
  process.exit(1);
});
