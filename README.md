# SPRAY RUN — endless runner 3D (web / PC)

Jeu 100 % original : personnages, modèles, textures, sons et musique sont créés par le code (et, pour quelques props, dans Blender).
Le dossier `SubwayAssets` n'est **pas** utilisé (assets extraits d'un jeu commercial).

## Lancer
```
npm install
npm run build          # compile l'application Next.js 16
npm start              # http://localhost:3000  (UI + API + temps réel sur le même port)
npm run dev            # mode développement (HMR)
```
Le serveur crée sa base SQLite dans `data/` (variable `DATA_DIR`). Port : `PORT=...`.
Le client parle toujours au serveur qui l'héberge : il n'y a aucune adresse de serveur à saisir.

## Contenu
- **5 cartes + World Tour** (ville, neige, tropiques, désert, néon) avec météo, cycle jour/nuit, horizon propre à chaque carte, tempêtes d'éclairs dans le quartier néon.
- **Cartes vivantes** : ponts avec circulation, grande roue, remontées mécaniques, voiliers, phare à faisceau tournant, volcan fumant, éoliennes, pompes à pétrole, boules de ronces, voitures volantes, projecteurs, oiseaux (pigeons, corbeaux, mouettes, vautours), fumée de cheminées.
- **Voies de garage** : trains **garés** (immobiles, comme dans un vrai dépôt) de chaque côté de la voie, et des trains qui **roulent** sur la voie voisine.
- **Trains** : métro, double-étage, TGV, diesel, électrique (pantographe), **vapeur** + tender (fumée), chasse-neige, tram tropical, maglev ; wagons : citerne, plat avec conteneurs, boîte, hopper (charbon), grumes, frigorifique, bétaillère, caboose. Des **trains arrivent de face** : phares, triangle d'alerte, klaxon.
- **Graffitis** : lettres bulles (extrusion 3D, contour, dégradé, reflets, trames, coulures, overspray), icônes, étoiles de choc, autocollants, zones repeintes, signatures à la main ; sur les murs et les trains.
- **Animation de départ** : le coureur est surpris en train de taguer un mur, le gardien siffle, le chien aboie, sprint, travelling de caméra.
- **Rendu cartoon** : ombrage à paliers, contours d'encre (post-process), lumière de contour, monde courbé, bloom ; pièces et gemmes modélisées ; caméra à ressorts avec FOV dynamique et caméra de mort.
- **Modes** : Classic, **No Coin** (toucher une pièce = fin), défi du jour ; chrono en jeu.
- **Valeurs de jeu réelles** : gravité, saut (2,2 corps, 0,89 s), roulade 0,6 s, changement de voie 0,27 s, vitesse 110→220 linéaire sur 179 s (`src/consts.js`).
- **UI** : transitions, icônes de power-ups, compteurs animés, confettis pour un record, astuces au chargement.

## En ligne
- **Comptes** invités persistants (jeton signé), **classements** (Classic, No Coin, Daily, Ranked ; tout / semaine / jour).
- **Ranked** : file d'attente à fourchette de niveau croissante (±80 → ±800), 2 à 4 joueurs, même piste (graine serveur), **Elo** par paires, paliers Bronze → Champion.
- **Parties privées** (code à 4 lettres) et Quick Match. Scores solo envoyés avec un **ticket signé à usage unique**.
- **Latence** : le gameplay est simulé localement (aucune latence sur tes commandes) ; le réseau ne transporte que les positions des autres (30 Hz, `TCP_NODELAY`, extrapolation + lissage).
- **Anti-triche** : plausibilité physique (temps vs horloge serveur, courbe de vitesse, formule de score, densité de pièces, cadence d'actions), télémétrie vérifiée en direct (téléportation, retour arrière, vitesse) avec disqualification, récidivistes exclus des classements. Ce n'est **pas** un rejeu déterministe (le jeu est simulé côté client) : un tricheur qui reproduit des valeurs plausibles peut passer.

## Tests automatiques (après `npm run build`)
```
node tools/backend.mjs                 # comptes, anti-triche, ranked, Elo, télémétrie (20 contrôles)
node tools/features.mjs                # animation de départ, trains, scenery, écran de fin, 5 cartes
node tools/smoke.mjs <dossier>         # serveur + UI + moteur + API + WebSocket
node tools/online.mjs <dossier>        # flux solo en ligne dans un vrai navigateur
node tools/mp.mjs <dossier>            # course à 2 navigateurs (même piste, fantômes, résultats)
node tools/sim.mjs 3 120 snow nocoin   # bot de jouabilité (runs, secondes, carte, mode)
node tools/debug.mjs <dossier> "<js>" <nom>   # capture d'écran après un snippet
```

## Blender
`tools/blender/make_props.py` modélise le coffre mystère et l'hoverboard et exporte `public/models/props.glb` :
```
"C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" -b -P tools/blender/make_props.py -- public/models/props.glb
```

## Structure
`app/`, `components/` : Next.js 16 + Tailwind 4 · `src/` : moteur Three.js (world, trains, graffiti, dynamic, biomes…) · `server/` : API, SQLite, matchmaking, anti-triche · `server.mjs` : Next + API + WebSocket · `tools/` : tests.
