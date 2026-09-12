/* Unfinished circuits stay isolated in Track-Lab. Shanghai is loaded directly
   by gt3-web-racer.html because it is a released production track. */
if (new URLSearchParams(location.search).get('trackLab') === '1') {
  for (const src of [
    'assets/tracks/madring_2026.js?v=20260911i',
    'assets/tracks/spa_francorchamps_2022.js?v=20260912b'
  ]) document.write('<script src="' + src + '" defer><' + '/script>');
}
