/* Register prototype tracks only when the dedicated Track-Lab URL requests them. */
if (new URLSearchParams(location.search).get('trackLab') === '1') {
  for (const src of [
    'assets/tracks/shanghai_2018.js?v=20260911c',
    'assets/tracks/madring_2026.js?v=20260911i',
    'assets/tracks/spa_francorchamps_2022.js?v=20260911b'
  ]) document.write('<script src="' + src + '" defer><' + '/script>');
}
