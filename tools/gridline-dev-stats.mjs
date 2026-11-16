#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const file = path.join(root, 'assets', 'gridline-dev-stats.json');
const args = process.argv.slice(2);
const valueAfter = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const minutes = Number(valueAfter('--add-minutes') || 0);
if (!Number.isFinite(minutes) || minutes < 0) throw new Error('--add-minutes must be a non-negative number');
const startSession = args.includes('--start-session');
const stopSession = args.includes('--stop-session');
if (startSession && stopSession) throw new Error('Use only one of --start-session or --stop-session');

const stats = JSON.parse(fs.readFileSync(file, 'utf8'));
const now = new Date();
const session = stats.developmentSession || { active: false, startedAt: '', source: 'Local session' };
if (startSession) {
  session.active = true;
  session.startedAt = now.toISOString();
}
if (stopSession && session.active && session.startedAt) {
  const started = Date.parse(session.startedAt);
  if (Number.isFinite(started)) stats.developmentTimeSeconds += Math.max(0, Math.floor((now.getTime() - started) / 1000));
  session.active = false;
  session.endedAt = now.toISOString();
  session.startedAt = '';
}
stats.developmentSession = session;
if (minutes > 0) stats.developmentTimeSeconds += Math.round(minutes * 60);
const activity = valueAfter('--activity');
const task = valueAfter('--task');
if (activity) stats.lastActivityLabel = activity;
if (task) stats.currentTask = task;
stats.lastDevelopmentActivity = now.toISOString();
fs.writeFileSync(file, `${JSON.stringify(stats, null, 2)}\n`);
console.log(`Updated GRIDLINE dev stats: +${minutes} minutes, total=${stats.developmentTimeSeconds}s, session=${session.active ? 'active' : 'paused'}`);
