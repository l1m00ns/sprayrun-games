# HDRI credits

`kloofendal_48d_partly_cloudy_puresky_1k.hdr` comes from [Poly Haven](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky),
released under [CC0](https://creativecommons.org/publicdomain/zero/1.0/) (public domain, no attribution required;
credited here as a courtesy).

It is used as the environment map (`scene.environment`): it lights and reflects on the runners, boards and
metal props. The visible sky is still the game's own shader (`src/sky.js`), so the time of day and weather keep
changing per biome and per event. The **HDRI reflections** setting turns this map off.
