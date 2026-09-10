#!/usr/bin/env node
/**
 * usage-dashboard.js
 *
 * Liest die lokale Claude/Codex-Nutzung via `ccusage` aus und stellt sie bereit:
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
 *   --ttl S      Cache-Dauer der ccusage-Abfrage in Sekunden (Default 300)
 *
 * Keine externen Dependencies. Braucht nur `npx ccusage` (wird bei Bedarf geladen).
 */

'use strict';

const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');

// ---- CLI-Argumente ---------------------------------------------------------
const argv = process.argv.slice(2);
function flag(name) { return argv.includes(name); }
function opt(name, def) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}

const PORT = parseInt(opt('--port', process.env.PORT || '4317'), 10);
const TTL_MS = parseInt(opt('--ttl', '300'), 10) * 1000;

// ---- ccusage aufrufen ------------------------------------------------------
function runCcusage(period) {
  return new Promise((resolve, reject) => {
    const args = ['-y', 'ccusage@latest', period, '--json'];
    const child = spawn('npx', args, { env: process.env });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0 && !out.trim()) {
        return reject(new Error(`ccusage ${period} exit ${code}: ${err.trim()}`));
      }
      try {
        // npm-Warnings landen ggf. in stderr; stdout ist reines JSON.
        resolve(JSON.parse(out));
      } catch (e) {
        reject(new Error(`JSON-Parse fehlgeschlagen: ${e.message}\n${out.slice(0, 300)}`));
      }
    });
  });
}

// ---- Feed aufbereiten ------------------------------------------------------
function num(x) { return typeof x === 'number' ? x : 0; }

function shapeMonthly(raw) {
  const rows = (raw && raw.monthly) || [];
  const months = rows.map((r) => ({
    period: r.period,
    agents: (r.metadata && r.metadata.agents) || [],
    models: r.modelsUsed || [],
    inputTokens: num(r.inputTokens),
    outputTokens: num(r.outputTokens),
    cacheCreationTokens: num(r.cacheCreationTokens),
    cacheReadTokens: num(r.cacheReadTokens),
    totalTokens: num(r.totalTokens),
    cost: Number(num(r.totalCost).toFixed(2)),
    byModel: (r.modelBreakdowns || []).map((m) => ({
      model: m.modelName,
      totalTokens: num(m.inputTokens) + num(m.outputTokens) +
        num(m.cacheCreationTokens) + num(m.cacheReadTokens),
      cost: Number(num(m.cost).toFixed(2)),
    })),
  }));
  const totalCost = Number(months.reduce((s, m) => s + m.cost, 0).toFixed(2));
  const totalTokens = months.reduce((s, m) => s + m.totalTokens, 0);
  const now = new Date();
  const thisMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const current = months.find((m) => m.period === thisMonth) || null;
  return {
    generatedAt: new Date().toISOString(),
    totals: { cost: totalCost, tokens: totalTokens, months: months.length },
    currentMonth: current,
    months,
  };
}

// ---- einfacher Cache -------------------------------------------------------
let cache = { at: 0, data: null, error: null };

async function getFeed(force) {
  if (!force && cache.data && (Date.now() - cache.at) < TTL_MS) {
    return cache.data;
  }
  const raw = await runCcusage('monthly');
  const feed = shapeMonthly(raw);
  cache = { at: Date.now(), data: feed, error: null };
  return feed;
}

// ---- Dashboard-HTML --------------------------------------------------------
const DASHBOARD_HTML = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Claude / Codex Usage</title>
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
  <h1>Claude / Codex Usage</h1>
  <div class="sub" id="sub">lade…</div>
  <div id="content"></div>
  <footer>Quelle: <code>ccusage monthly</code> (lokale Logs, Kosten geschaetzt). Auto-Refresh alle 60&nbsp;s.</footer>
<script>
const fmtN = (n) => new Intl.NumberFormat('de-DE').format(n);
const fmtT = (n) => n >= 1e9 ? (n/1e9).toFixed(2)+' B' : n >= 1e6 ? (n/1e6).toFixed(1)+' M' : fmtN(n);
const fmt$ = (n) => '$' + new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(n);

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
setInterval(load, 60000);
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
