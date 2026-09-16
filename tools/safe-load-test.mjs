import { performance } from 'node:perf_hooks';

const DEFAULT_PATHS = [
  '/',
  '/gt3-web-racer.html',
  '/assets/gt3-firebase.js?v=22',
];

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const args = parseArgs(process.argv.slice(2));
const baseUrl = new URL(args.base ?? 'http://127.0.0.1:8787');
const total = clampNumber(args.total, 1000, 1, 20000);
const concurrency = clampNumber(args.concurrency, 8, 1, 50);
const timeoutMs = clampNumber(args.timeout, 15000, 1000, 30000);
const maxFailureRate = clampNumber(args.maxFailureRate, 0.03, 0, 1);
const maxRecentAvgMs = clampNumber(args.maxRecentAvgMs, 2500, 100, 30000);
const paths = args.paths ? String(args.paths).split(',').filter(Boolean) : DEFAULT_PATHS;

if (!['http:', 'https:'].includes(baseUrl.protocol)) {
  throw new Error(`Unsupported protocol: ${baseUrl.protocol}`);
}

if (!LOCAL_HOSTS.has(baseUrl.hostname)) {
  throw new Error(
    `Refusing to load-test non-local host "${baseUrl.hostname}". ` +
    'Use localhost/127.0.0.1 for safe capacity tests.'
  );
}

const targets = paths.map((item) => new URL(item, baseUrl).toString());
const results = [];
let cursor = 0;
let aborted = false;

async function hit(index) {
  const url = targets[index % targets.length];
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        accept: '*/*',
        'user-agent': 'GridlineLocalCapacityCheck/1.0',
      },
      signal: controller.signal,
    });
    const bytes = (await response.arrayBuffer()).byteLength;
    results.push({ url, ok: response.ok, status: response.status, ms: performance.now() - started, bytes });
  } catch (error) {
    results.push({ url, ok: false, status: 'ERR', ms: performance.now() - started, bytes: 0, error: error.name });
  } finally {
    clearTimeout(timer);
  }
}

function shouldAbort() {
  if (results.length < Math.max(100, concurrency * 10)) {
    return false;
  }

  const failures = results.filter((item) => !item.ok).length;
  const failureRate = failures / results.length;
  const recent = results.slice(-Math.max(50, concurrency * 5)).map((item) => item.ms);
  const recentAvg = average(recent);
  return failureRate > maxFailureRate || recentAvg > maxRecentAvgMs;
}

async function worker() {
  while (!aborted && cursor < total) {
    const index = cursor++;
    await hit(index);
    if (shouldAbort()) {
      aborted = true;
    }
  }
}

const startedAll = performance.now();
await Promise.all(Array.from({ length: concurrency }, worker));
const elapsed = performance.now() - startedAll;

printSummary();

function printSummary() {
  const byUrl = new Map();
  for (const item of results) {
    const bucket = byUrl.get(item.url) ?? [];
    bucket.push(item);
    byUrl.set(item.url, bucket);
  }

  console.log(`local_load_base=${baseUrl}`);
  console.log(`local_load_requested=${total}`);
  console.log(`local_load_completed=${results.length}`);
  console.log(`local_load_concurrency=${concurrency}`);
  console.log(`aborted=${aborted}`);
  console.log(`elapsed_ms=${elapsed.toFixed(1)}`);
  console.log(`requests_per_second=${(results.length / Math.max(elapsed / 1000, 0.001)).toFixed(2)}`);
  console.log(`success=${results.filter((item) => item.ok).length}`);
  console.log(`fail=${results.filter((item) => !item.ok).length}`);

  for (const [url, list] of byUrl) {
    const times = list.map((item) => item.ms);
    const statuses = [...new Set(list.map((item) => item.status))].join(',');
    const avgBytes = Math.round(average(list.map((item) => item.bytes)));
    console.log(`url=${url}`);
    console.log(
      `  count=${list.length} statuses=${statuses}` +
      ` avg_ms=${average(times).toFixed(1)}` +
      ` p50_ms=${percentile(times, 50).toFixed(1)}` +
      ` p95_ms=${percentile(times, 95).toFixed(1)}` +
      ` p99_ms=${percentile(times, 99).toFixed(1)}` +
      ` avg_bytes=${avgBytes}`
    );
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i++) {
    const current = argv[i];
    if (!current.startsWith('--')) {
      continue;
    }

    const key = current.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    i++;
  }
  return parsed;
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

function average(values) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values, percentileValue) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[index];
}
