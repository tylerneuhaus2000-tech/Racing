/* Shanghai is released. Madring and Spa remain isolated in Track-Lab. */
document.write('<script src="assets/tracks/shanghai_2018.js?v=20260911d" defer><' + '/script>');
if (new URLSearchParams(location.search).get('trackLab') === '1') {
  for (const src of [
    'assets/tracks/madring_2026.js?v=20260911i',
    'assets/tracks/spa_francorchamps_2022.js?v=20260911b'
  ]) document.write('<script src="' + src + '" defer><' + '/script>');
}
