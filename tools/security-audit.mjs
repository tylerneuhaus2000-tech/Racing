const targets = [
  'https://grid-line.de/',
  'https://grid-line.de/gt3-web-racer.html',
  'https://grid-line.de/assets/gt3-firebase.js?v=22',
  'https://grid-line.de/.well-known/security.txt',
];

const requiredHeaders = [
  'cf-cache-status',
  'cache-control',
  'content-type',
];

let failures = 0;

for (const target of targets) {
  const response = await fetch(target, {
    method: 'GET',
    headers: {
      accept: '*/*',
      'user-agent': 'GridlineSecurityAudit/1.0',
    },
  });

  const body = await response.arrayBuffer();
  console.log(`${target}`);
  console.log(`  status=${response.status}`);
  console.log(`  bytes=${body.byteLength}`);

  for (const header of requiredHeaders) {
    console.log(`  ${header}=${response.headers.get(header) ?? '-'}`);
  }

  if (!response.ok) {
    failures++;
    console.log('  problem=response not ok');
  }

  if (target.includes('/assets/') && response.headers.get('cf-cache-status') === 'DYNAMIC') {
    failures++;
    console.log('  problem=asset is dynamic at Cloudflare; check Cache Rules');
  }

  if (target.endsWith('/.well-known/security.txt')) {
    const text = Buffer.from(body).toString('utf8');
    if (!text.includes('Contact:') || !text.includes('Expires:')) {
      failures++;
      console.log('  problem=security.txt is missing Contact or Expires');
    }
  }
}

if (failures > 0) {
  console.error(`Security audit finished with ${failures} problem(s).`);
  process.exit(1);
}

console.log('Security audit finished without blocking problems.');
