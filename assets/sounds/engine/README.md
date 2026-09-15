# Engine sound samples

Place licensed engine loop samples in this folder and register them in
`manifest.json`.

Use only sounds that you have the right to ship with the game. Good sources are
your own recordings, bought game-audio vehicle libraries, or royalty-free sounds
whose license explicitly allows redistribution in a game.

Recommended file format:

- `ogg` for browser builds
- short seamless loops, ideally 1-4 seconds
- separate RPM layers such as idle, low, mid, high
- normalized but not clipped

The game keeps its procedural engine synth as a fallback. If a profile has no
layers, or a file cannot be loaded, gameplay continues with the synth sound.

