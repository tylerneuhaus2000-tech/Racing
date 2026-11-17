// Minimal CDP-only QA driver for the isolated, visible GRIDLINE Chrome session.
// It observes the game's existing track/vehicle state and sends ordinary key events;
// it never writes to Game state or changes physics parameters.
import fs from 'node:fs';

const targetList = await fetch('http://127.0.0.1:9229/json/list').then(r => r.json());
const target = targetList.find(t => t.type === 'page' && t.url.includes('/gt3-web-racer.html'));
if (!target) throw new Error('GRIDLINE page target not found on CDP port 9229');

const root = 'qa/web-playtest/session-20261009T0631Z-35bacfd';
const run = process.argv[2] || 'lap-attempt-04';
const backgroundRun = process.argv.includes('--background');
const telemetryPath = `${root}/telemetry/${run}.jsonl`;
const eventsPath = `${root}/telemetry/${run}-events.jsonl`;
const shotDir = `${root}/screenshots`;
fs.mkdirSync(shotDir, { recursive: true });
for (const path of [telemetryPath, eventsPath]) fs.writeFileSync(path, '');

const ws = new WebSocket(target.webSocketDebuggerUrl);
let nextId = 0;
const pending = new Map();
const keys = new Set();
const cdp = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
  pending.set(id, message => { clearTimeout(timeout); resolve(message); });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const response = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.error) throw new Error(response.error.message);
  if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.text);
  return response.result?.result?.value;
};
const append = (path, value) => fs.appendFileSync(path, `${JSON.stringify(value)}\n`);
const now = () => new Date().toISOString();
let lastSample = null;
let lastErrorCapture = 0;
let repeatedConsoleErrors = 0;
const keyCode = { KeyW: 87, KeyS: 83, KeyA: 65, KeyD: 68, KeyE: 69 };
async function setKeys(next) {
  for (const code of [...keys]) if (!next.has(code)) {
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', code, key: code.slice(3), windowsVirtualKeyCode: keyCode[code] });
    keys.delete(code);
  }
  for (const code of next) if (!keys.has(code)) {
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', code, key: code.slice(3), windowsVirtualKeyCode: keyCode[code] });
    keys.add(code);
  }
}
async function capture(label, sample) {
  const shot = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 76, captureBeyondViewport: false });
  const file = `${shotDir}/${run}-${label}.jpg`;
  fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
  append(`${root}/screenshots/evidence-index.jsonl`, {
    ts: now(), file, vehicle: sample?.vehicle ?? 'Ferrari 296 GT3', track: sample?.track ?? 'Silverstone GP',
    session: run, speedKmh: sample?.speedKmh ?? 0, progress: sample?.progress ?? null,
    gear: sample?.gear ?? 0, input: [...keys], lap: sample?.lap ?? 1,
    sector: sample?.sector ?? null, note: label,
  });
}

ws.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
    return;
  }
  const method = message.method;
  if (!['Runtime.exceptionThrown', 'Runtime.consoleAPICalled', 'Log.entryAdded', 'Network.loadingFailed'].includes(method)) return;
  const params = message.params || {};
  const text = params.exceptionDetails?.exception?.description || params.entry?.text || params.errorText ||
    params.args?.map(a => a.value || a.description || '').join(' ').slice(0, 1200) || '';
  const isError = method === 'Runtime.exceptionThrown' || params.entry?.level === 'error' || params.type === 'error';
  if (isError) {
    repeatedConsoleErrors++;
    if (repeatedConsoleErrors === 1 || repeatedConsoleErrors % 20 === 0 || method !== 'Runtime.consoleAPICalled') {
      append(eventsPath, { ts: now(), type: method, errorNumber: repeatedConsoleErrors, text, url: params.entry?.url || params.url || '', line: params.exceptionDetails?.lineNumber });
    }
    if (Date.now() - lastErrorCapture > 5000) {
      lastErrorCapture = Date.now();
      capture(`event-error-${Date.now()}`, lastSample).catch(() => {});
    }
  } else {
    append(eventsPath, { ts: now(), type: method, text, url: params.entry?.url || params.url || '', line: params.exceptionDetails?.lineNumber });
  }
};

ws.onopen = async () => {
  try {
    await cdp('Page.enable');
    await cdp('Runtime.enable');
    await cdp('Log.enable');
    await cdp('Network.enable');
    await cdp('Performance.enable');
    if (!backgroundRun) await cdp('Page.bringToFront');
    const environment = await evaluate(`({ua:navigator.userAgent, url:location.href, focused:document.hasFocus(),
      visibility:document.visibilityState,
      canvas:[...document.querySelectorAll('canvas')].map(c=>({w:c.width,h:c.height,css:c.getBoundingClientRect().toJSON()})),
      gl:(()=>{const c=document.querySelector('canvas');const g=c?.getContext('webgl2')||c?.getContext('webgl');return g?{version:g.getParameter(g.VERSION),renderer:g.getParameter(g.RENDERER)}:null})(),
      car:Game.selCar, track:Game.trackDef?.id, totalLen:Game.track?.totalLen})`);
    append(eventsPath, { ts: now(), type: 'session-start', revision: '35bacfdc5a3eed67ead24acd97171d9cbb9c5924', environment });

    let startMs = Date.now();
    let lastShot = 0;
    let lastRecord = 0;
    let lastWalls = 0;
    let lastDamage = 0;
    let lastEventShot = 0;
    let previousSpeed = 0;
    const fpsSamples = [];
    let lapComplete = false;
    let reason = 'time-limit';
    const sampleExpression = `(()=>{
      const t=Game.track,c=Game.car,r=Game.race,q=c?.query,s=t?.samples||[];
      if(!t||!c||!r||!q)return null;
      const n=t.N,step=t.totalLen/n,idx=((c.sampleIdx%n)+n)%n,v=Math.hypot(c.vx||0,c.vy||0);
      const aimDist=Math.min(34,18+v*.30),aimIdx=(idx+Math.max(1,Math.round(aimDist/step)))%n,a=s[aimIdx];
      let ex=a.pos.x-c.pos.x,ez=a.pos.z-c.pos.z;
      const corr=Math.max(-3,Math.min(3,(q.lat||0)*.30)); ex-=q.side.x*corr;ez-=q.side.z*corr;
      let err=Math.atan2(ex,ez)-c.heading;while(err>Math.PI)err-=2*Math.PI;while(err< -Math.PI)err+=2*Math.PI;
      const steer=Math.max(-1,Math.min(1,err*2.5-(c.yawRate||0)*.16));
      let curv=0;for(let d=0;d<=150;d+=9){const j=(idx+Math.round(d/step))%n;curv=Math.max(curv,Math.abs(s[j]?.curv||0));}
      // Faster test pace: retain a conservative 1.27g lateral target, but avoid
      // braking for distant bends across the old 220m window.
      const targetV=Math.max(18,Math.min(70,Math.sqrt(12.5/Math.max(curv,.0015))));
      const speedKmh=v*3.6,lat=q.lat||0;
      const fps=document.getElementById('stat-fps')?.textContent?.match(/[0-9]+/)?.[0];
      return {ts:new Date().toISOString(),raceTime:Game._raceTimeS,lap:r.lap,curLapTime:r.curLapTime,lastLap:r.lastLap,
        lapValid:r.lapValid,sector:r.sector,sectors:r.curSectors,progress:q.progress,distM:c.totalDistance,
        speedKmh,speedMps:v,targetKmh:targetV*3.6,gear:c.gear,heading:c.heading,yawRate:c.yawRate,steer:c.steer,
        steerCmd:steer,latM:lat,surface:q.surf,curvature:curv,accLong:c.accLong,latAccel:c.lastAy,
        slipFront:c.slipFront,slipRear:c.slipRear,damage:c.totalDamage,wallContacts:c.wallContacts,carContacts:c.carContacts,
        fuelKg:c.fuelKg,tireWear:c.tireWear,fps:fps?Number(fps):null,focused:document.hasFocus(),visibility:document.visibilityState,
        gameInput:Game.input?{steer:Game.input.steer,throttle:Game.input.throttle,brake:Game.input.brake,
          keyW:Game.input.keys?.KeyW,keyS:Game.input.keys?.KeyS,keyA:Game.input.keys?.KeyA,keyD:Game.input.keys?.KeyD}:null,
        vehicle:CARS[Game.selCar]?.name||Game.selCar,track:Game.trackDef?.name||Game.trackDef?.id||'',
        halfWidth:t.halfW, kerbWidth:t.kerbW||0, sampleIdx:idx};
    })()`;
    await capture('start', null);
    let focusWasLost = false;
    let lastMotionAt = startMs;
    let lastMotionDist = null;
    let lastRecoveryAt = 0;
    let lastInputAudit = 0;
    let offTrackSlowSince = null;
    while (Date.now() - startMs < 270000) {
      if (!backgroundRun && !(await evaluate('document.hasFocus()'))) {
        if (!focusWasLost) append(eventsPath, { ts: now(), type: 'focus-loss', action: 'Page.bringToFront' });
        focusWasLost = true;
        await setKeys(new Set());
        await cdp('Page.bringToFront');
        await new Promise(resolve => setTimeout(resolve, 120));
        continue;
      }
      if (focusWasLost) append(eventsPath, { ts: now(), type: 'focus-restored', action: 'resync-inputs' });
      focusWasLost = false;
      const s = await evaluate(sampleExpression);
      if (!s) { await new Promise(resolve => setTimeout(resolve, 100)); continue; }
      lastSample = s;
      if (s.fps != null) fpsSamples.push(s.fps);
      const currentSpeed = s.speedMps;
      let command = new Set();
      const timeNow = Date.now();
      const moved = s.speedMps > 1.8 || (lastMotionDist != null && Math.abs((s.distM || 0) - lastMotionDist) > 1.5);
      if (moved) lastMotionAt = timeNow;
      lastMotionDist = s.distM || 0;
      const recoverStalled = timeNow - startMs > 12000 && timeNow - lastMotionAt > 6000 && timeNow - lastRecoveryAt > 9000;
      // Off-track recovery is a normal in-game respawn key, only after confirmed departure.
      const offTrackEdge = s.halfWidth + s.kerbWidth + .6;
      if (Math.abs(s.latM) > offTrackEdge && s.surface === 2) {
        if (s.speedMps < 3) offTrackSlowSince ??= timeNow;
        else if (s.speedMps > 4) offTrackSlowSince = null;
        if (!lastEventShot || Date.now() - lastEventShot > 5000) {
          append(eventsPath, { ts: now(), type: 'off-track', latM: s.latM, speedKmh: s.speedKmh });
          await capture(`event-offtrack-${Date.now()}`, s);
          lastEventShot = Date.now();
        }
        const offTrackSlowStall = offTrackSlowSince != null && timeNow - offTrackSlowSince > 5000 && timeNow - lastRecoveryAt > 9000;
        if (Math.abs(s.latM) > offTrackEdge + 1.5 || offTrackSlowStall) {
          append(eventsPath, { ts: now(), type: 'off-track-recovery', latM: s.latM, speedKmh: s.speedKmh, reason: offTrackSlowStall ? 'low-speed-stall' : 'far-off-track' });
          command.add('KeyE');
          lastRecoveryAt = timeNow;
          offTrackSlowSince = timeNow;
        } else command.add('KeyS');
      } else if (recoverStalled) {
        offTrackSlowSince = null;
        append(eventsPath, { ts: now(), type: 'stalled-recovery', progress: s.progress, distM: s.distM, speedKmh: s.speedKmh });
        await capture(`event-stalled-${Date.now()}`, s);
        command.add('KeyE');
        if (s.speedMps < (s.targetKmh / 3.6) - 1.6) command.add('KeyW');
        lastRecoveryAt = timeNow;
      } else {
        offTrackSlowSince = null;
        if (s.steerCmd > .13) command.add('KeyA');
        if (s.steerCmd < -.13) command.add('KeyD');
        if (s.speedMps > (s.targetKmh / 3.6) + 1.4) command.add('KeyS');
        else if (s.speedMps < (s.targetKmh / 3.6) - 1.6) command.add('KeyW');
      }
      await setKeys(command);
      if (timeNow - lastInputAudit >= 1000) {
        lastInputAudit = timeNow;
        const actual = await evaluate('Game.input?{throttle:Game.input.throttle,brake:Game.input.brake,steer:Game.input.steer,keyW:Game.input.keys?.KeyW}:null');
        if (s.raceTime > 3 && command.has('KeyW') && (!actual || actual.throttle < .05 || !actual.keyW)) {
          append(eventsPath, { ts: now(), type: 'input-desync', intended: [...command], actual });
          await setKeys(new Set());
          await new Promise(resolve => setTimeout(resolve, 80));
          await setKeys(command);
        }
      }
      const wallCount = s.wallContacts || 0;
      const damage = s.damage || 0;
      if ((wallCount > lastWalls || damage > lastDamage + .25 || Math.abs(s.yawRate) > 1.35) && Date.now() - lastEventShot > 5000) {
        const type = wallCount > lastWalls ? 'collision' : damage > lastDamage + .25 ? 'damage-change' : 'extreme-yaw';
        append(eventsPath, { ts: now(), type, speedKmh: s.speedKmh, latM: s.latM, yawRate: s.yawRate, wallContacts: wallCount, damage });
        await capture(`event-${type}-${Date.now()}`, s);
        lastEventShot = Date.now();
      }
      lastWalls = wallCount;
      lastDamage = damage;
      if (Date.now() - lastRecord >= 1000) {
        append(telemetryPath, { ...s, input: [...keys], accelObservedMps2: (currentSpeed - previousSpeed) / Math.max(.08, (Date.now() - lastRecord) / 1000) });
        previousSpeed = currentSpeed;
        lastRecord = Date.now();
      }
      if (Date.now() - lastShot >= 3500) {
        await capture(`${Math.floor((Date.now() - startMs) / 1000)}s`, s);
        lastShot = Date.now();
      }
      if ((s.lastLap || 0) > 10 || (s.lap || 1) > 1) { lapComplete = true; reason = 'lap-complete'; break; }
      if (s.speedKmh < 1 && Date.now() - startMs > 30000 && (s.distM || 0) < 20) {
        append(eventsPath, { ts: now(), type: 'stalled-at-start', focused: s.focused, input: [...keys], raceTime: s.raceTime });
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    await setKeys(new Set());
    await capture('end', lastSample);
    const metrics = await cdp('Performance.getMetrics');
    const sorted = [...fpsSamples].sort((a,b)=>a-b);
    const percentile = p => sorted.length ? sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*p))] : null;
    const summary = {
      ts: now(), run, reason, lapComplete, actualDriveSeconds: (Date.now()-startMs)/1000,
      samples: fpsSamples.length, fps: { min: sorted[0] ?? null, p50: percentile(.5), p95: percentile(.95), max: sorted.at(-1) ?? null },
      final: lastSample, performanceMetrics: metrics.result?.metrics || [],
      screenshotCount: fs.readdirSync(shotDir).filter(name => name.startsWith(`${run}-`)).length,
    };
    fs.writeFileSync(`${root}/telemetry/${run}-summary.json`, `${JSON.stringify(summary,null,2)}\n`);
    append(eventsPath, { ts: now(), type: 'session-end', reason, lapComplete, summaryPath: `${root}/telemetry/${run}-summary.json` });
    console.log(JSON.stringify(summary));
    ws.close();
  } catch (error) {
    await setKeys(new Set()).catch(() => {});
    append(eventsPath, { ts: now(), type: 'driver-error', text: String(error?.stack || error) });
    console.error(error);
    ws.close();
    process.exitCode = 1;
  }
};
