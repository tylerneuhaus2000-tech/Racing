#!/usr/bin/env node

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const WORLD_BANK_BASE = 'https://api.worldbank.org/v2';

const INDICATORS = {
  population: 'SP.POP.TOTL',
  area: 'AG.LND.TOTL.K2',
  gdpPerCapita: 'NY.GDP.PCAP.CD',
  forestPercentage: 'AG.LND.FRST.ZS',
  lifeExpectancy: 'SP.DYN.LE00.IN',
  renewableEnergy: 'EG.FEC.RNEW.ZS',
  tourists: 'ST.INT.ARVL',
  corruptionScore: 'CC.EST'
};

const RANK_METRICS_DESC = [
  'gdpPerCapita',
  'population',
  'area',
  'forestPercentage',
  'tourists',
  'renewableEnergy',
  'lifeExpectancy',
  'corruptionScore'
];

const RANK_METRICS_ASC = [];

const GAME_RANK_FIELDS = [
  'gdpPerCapita',
  'crimeRisk',
  'population',
  'oilProduction',
  'forestPercentage',
  'averageTemperature',
  'olympicMedals'
];

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function toNumOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status} for ${url}`);
  }
  return res.json();
}

function iso2ToFlag(iso2) {
  if (!/^[A-Z]{2}$/.test(iso2)) return '🏳️';
  const base = 0x1f1e6;
  const chars = iso2
    .split('')
    .map((ch) => String.fromCodePoint(base + (ch.charCodeAt(0) - 65)));
  return chars.join('');
}

async function fetchWorldBankCountries() {
  const url = `${WORLD_BANK_BASE}/country?format=json&per_page=400`;
  const payload = await fetchJson(url);
  const rows = Array.isArray(payload) ? payload[1] || [] : [];

  return rows
    .filter((r) => /^[A-Z]{2}$/.test((r?.iso2Code || '').toUpperCase()))
    .filter((r) => /^[A-Z]{3}$/.test((r?.id || '').toUpperCase()))
    .filter((r) => (r?.region?.id || '') !== 'NA')
    .map((r) => {
      const iso2 = r.iso2Code.toUpperCase();
      const iso3 = r.id.toUpperCase();
      return {
        name: r.name,
        flag: iso2ToFlag(iso2),
        capital: r.capitalCity || null,
        continent: r.region?.value || null,
        cca2: iso2,
        cca3: iso3
      };
    });
}

async function fetchWorldBankLatest(indicatorCode) {
  const url = `${WORLD_BANK_BASE}/country/all/indicator/${indicatorCode}?format=json&per_page=20000`;
  const payload = await fetchJson(url);
  const rows = Array.isArray(payload) ? payload[1] || [] : [];
  const latestByIso3 = new Map();

  for (const row of rows) {
    const iso3 = (row?.countryiso3code || '').trim().toUpperCase();
    const value = toNumOrNull(row?.value);
    const year = Number(row?.date);

    if (!/^[A-Z]{3}$/.test(iso3)) continue;
    if (value == null) continue;
    const prev = latestByIso3.get(iso3);
    if (!prev || year > prev.year) {
      latestByIso3.set(iso3, { value, year });
    }
  }
  return latestByIso3;
}

function buildRankMap(items, key, direction = 'desc') {
  const ranked = items
    .filter((x) => isFiniteNumber(x[key]))
    .sort((a, b) => {
      if (direction === 'asc') return a[key] - b[key];
      return b[key] - a[key];
    });

  const map = new Map();
  ranked.forEach((item, idx) => map.set(item.cca3, idx + 1));
  return map;
}

function buildCompleteRankMap(items, valueAccessor, direction = 'desc') {
  const known = [];
  const missing = [];

  for (const item of items) {
    const value = toNumOrNull(valueAccessor(item));
    if (value == null) missing.push(item);
    else known.push({ item, value });
  }

  known.sort((a, b) => {
    if (direction === 'asc') {
      if (a.value !== b.value) return a.value - b.value;
    } else {
      if (a.value !== b.value) return b.value - a.value;
    }
    return a.item.name.localeCompare(b.item.name, 'de');
  });

  missing.sort((a, b) => a.name.localeCompare(b.name, 'de'));

  const rankMap = new Map();
  let rank = 1;
  for (const entry of known) {
    rankMap.set(entry.item.cca3, rank);
    rank += 1;
  }
  for (const item of missing) {
    rankMap.set(item.cca3, rank);
    rank += 1;
  }

  return rankMap;
}

async function main() {
  const wbCountries = await fetchWorldBankCountries();

  const [population, area, gdp, forest, life, renewable, tourists, corruption] = await Promise.all([
    fetchWorldBankLatest(INDICATORS.population),
    fetchWorldBankLatest(INDICATORS.area),
    fetchWorldBankLatest(INDICATORS.gdpPerCapita),
    fetchWorldBankLatest(INDICATORS.forestPercentage),
    fetchWorldBankLatest(INDICATORS.lifeExpectancy),
    fetchWorldBankLatest(INDICATORS.renewableEnergy),
    fetchWorldBankLatest(INDICATORS.tourists),
    fetchWorldBankLatest(INDICATORS.corruptionScore)
  ]);

  const countries = wbCountries
    .map((c) => {
      const iso3 = c.cca3;
      return {
        name: c.name,
        flag: c.flag,
        capital: c.capital,
        continent: c.continent,
        cca2: c.cca2,
        cca3: iso3,
        population: population.get(iso3)?.value ?? null,
        area: area.get(iso3)?.value ?? null,
        gdpPerCapita: gdp.get(iso3)?.value ?? null,
        forestPercentage: forest.get(iso3)?.value ?? null,
        averageTemperature: null,
        tourists: tourists.get(iso3)?.value ?? null,
        oilProduction: null,
        olympicMedals: null,
        renewableEnergy: renewable.get(iso3)?.value ?? null,
        lifeExpectancy: life.get(iso3)?.value ?? null,
        corruptionRank: null,
        coastline: null,
        corruptionScore: corruption.get(iso3)?.value ?? null,
        ranks: {}
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));

  for (const metric of RANK_METRICS_DESC) {
    const map = buildRankMap(countries, metric, 'desc');
    for (const c of countries) {
      c.ranks[metric] = map.get(c.cca3) ?? null;
    }
  }

  for (const metric of RANK_METRICS_ASC) {
    const map = buildRankMap(countries, metric, 'asc');
    for (const c of countries) {
      c.ranks[metric] = map.get(c.cca3) ?? null;
    }
  }

  for (const c of countries) {
    c.corruptionRank = c.ranks.corruptionScore ?? null;
    c.crimeRisk = c.corruptionRank;
  }

  const completeRankSpecs = {
    gdpPerCapita: (c) => c.gdpPerCapita,
    crimeRisk: (c) => c.crimeRisk,
    population: (c) => c.population,
    oilProduction: (c) => c.oilProduction,
    forestPercentage: (c) => c.forestPercentage,
    averageTemperature: (c) => c.averageTemperature,
    olympicMedals: (c) => c.olympicMedals
  };

  for (const field of GAME_RANK_FIELDS) {
    const map = buildCompleteRankMap(countries, completeRankSpecs[field], 'desc');
    for (const c of countries) {
      c.ranks[field] = map.get(c.cca3) ?? null;
    }
  }

  const output = {
    metadata: {
      generatedAt: new Date().toISOString(),
      sources: {
        countries: 'World Bank countries endpoint',
        worldBank: {
          population: INDICATORS.population,
          area: INDICATORS.area,
          gdpPerCapita: INDICATORS.gdpPerCapita,
          forestPercentage: INDICATORS.forestPercentage,
          lifeExpectancy: INDICATORS.lifeExpectancy,
          renewableEnergy: INDICATORS.renewableEnergy,
          tourists: INDICATORS.tourists,
          corruptionScore: INDICATORS.corruptionScore
        }
      },
      notes: [
        'All numeric values come from source APIs at generation time.',
        'Fields without robust global source in this pipeline are null and can be backfilled later.',
        'World ranks are computed automatically from available numeric metrics.',
        'For blind-ranking game fields, every country receives a deterministic rank; missing-value countries are placed after known-value countries.'
      ]
    },
    countries
  };

  const outPath = path.resolve(process.cwd(), 'countries.json');
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(output, null, 2), 'utf8');

  console.log(`countries.json written with ${countries.length} countries`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
