# REVERSE SURFERS — endless runner 3D (web / PC)

Jeu 100 % original : personnages, modèles, textures, sons et musique sont créés par le code (et, pour quelques props, dans Blender).
Le dossier `SubwayAssets` n'est **pas** utilisé (assets extraits d'un jeu commercial). Logo : `logo.png` (racine, copié dans `public/`).

## Lancer
```
npm install
cp .env.example .env     # clés IA (optionnelles), ADMIN_KEY ...
npm run dev:all          # backend (http://localhost:4000) + web (http://localhost:3000)
npm run build && npm start   # production : UI + API + temps réel sur le même port (3000)
npm run dev              # tout-en-un en développement (HMR)
```
Base SQLite dans `data/` (`DATA_DIR`). Node ≥ 22.13. Le client parle à son propre serveur par défaut. **Backend ailleurs (Render, Railway…)** : `NEXT_PUBLIC_BACKEND_URL=https://ton-service.onrender.com` dans le `.env` du front (figé au `npm run build`), ou `public/config.js` pour changer sans reconstruire ; côté backend `CORS_ORIGIN=https://ton-front` et `TRUST_PROXY=1`. La version s’affiche dans Paramètres (`3.0.1-<commit>`).

## Jeu
- **5 cartes + World Tour**, météo, jour/nuit, scènes animées, **graffitis**, animation de départ. **Palm Bay** refaite : mer animée (reflets, écume), ponton, bar tiki, filet de volley, serviettes, pirogue, bouées, palmiers penchés.
- **Trains solides** : les wagons sont des murs, le toit reste une plateforme accessible seulement avec les Super Sneakers (pas de rampes, pas de ligne de pièces sur le toit). Un choc frontal te projette hors du wagon, et le train ne traverse plus le personnage pendant l’animation de mort. Wagons plus nombreux et plus longs (jusqu’à 4), **couloirs** (slalom, enchaînements saut/roulade entre deux murs), écarts qui se resserrent et deuxième palier de difficulté après ~4,5 km ; vitesse plafond ×1,6. Les chocs ont leur animation (trébuchement, coup latéral, tête cognée, projection en arrière + étoiles + arrêt sur image).
- **Rio** (héros original : casquette, doudoune) + 12 coureurs, tenues, planches et traînées (boutique).
- **Vitesse progressive** : la rampe authentique (110→220) continue ensuite vers ×1,4 ; **commandes « snappy »** (changement de voie 0,13 s, entrées appliquées instantanément) ou « classiques » (0,27 s).
- **Neon Rush** (événement limité) : la ville passe de nuit, les rails s'allument et les pièces brillent en magenta. **Double Score offert au départ**, **aimant à 400 m**, gemmes néon et HUD dédié. Jouable hors ligne depuis la carte de mode ou le bouton NEON RUSH ; rien à télécharger, aucun duel.
- **Quatre saisons** (horloge UTC identique pour tous) : **Egg Hunt** (20 mars → 20 avril), **Haunted Rails** (1er oct. → 2 nov.), **Winter Fest** (1er déc. → 6 janv.) et **calendrier de l'avent** de 25 portes. Chaque événement a ses cosmétiques limités et un **cadeau gratuit** à réclamer une fois par compte.
- **Langues** : bouton 🌐 + écran d'accueil à la première visite (langue, apparence, commandes/caméra, fair-play & vie privée, compte). Anglais et français (traduction en direct de toute l'interface ; ajouter une langue = un dictionnaire dans `src/i18n.js`).
- **Interface** : barre supérieure (Jouer, Boutique, Carrière, Classement, Événements, Mises à jour, Support), profil, **statistiques** en graphiques, **paramètres** (≈35 options : graphismes, caméra, commandes, audio, accessibilité), aucune pop-up navigateur (dialogues natifs), scrollbars masquées.

## 3.0.1 — mobile, hitbox, multijoueur
- **Menu téléphone** : bouton trois barres et feuille avec tous les onglets, compte, amis, réglages et langue ; cibles tactiles plus grandes et safe-area respectée.
- **Modes online** : une recherche Normal/Ranked Solo, Duos ou Trios ne devient plus Neon Rush ; seul un spec avec l’event néon ouvre Neon.
- **Hitbox** : les trains, wagons et conteneurs mesurent leur boîte depuis le modèle 3D, les carrosseries sont carrées et la hitbox du joueur est calculée depuis son torse.

## 2.0.2 — multijoueur corrigé
- **Tous les modes online gardent leur identité** : un spec Normal/Ranked Solo, Duos ou Trios n’est plus confondu avec Neon Rush. La carte de mode, l’écran de recherche et la salle affichent le bon mode ; Neon Rush reste le seul mode avec l’event néon.
- **File d’attente réparée** : chaque mode a sa propre clé de recherche et son propre spec, et le mode choisi est renvoyé tel quel au serveur.

## 2.0.1 — spectateur, online, fair-play
- **Spectateur** : caméra de poursuite derrière le leader, coureur mort masqué, et **mêmes obstacles pour tous** (les trains mobiles ne bougent plus en multijoueur et un crash ne supprime plus localement un wagon).
- **Neon Rush en ligne** : même file, recherche, préparation et lancement que les autres modes ; l'événement et la carte néon sont transmis à tous les joueurs. Tous les modes multijoueur portent maintenant leur event.
- **PLAY réparé** : après une course, chaque groupe repasse en `idle` côté serveur et l'overlay de recherche est nettoyé au lancement, aux résultats et en quittant un salon. Le bouton ne reste plus bloqué sur SEARCHING.
- **Fair-play sans faux positif** : l'avis de l'IA et un flag mou ne peuvent plus sanctionner seuls. Seules les violations physiques impossibles (distance impossible, téléportation) disqualifient la course, et leur répétition peut terminer la session.
- **Caméra** : hauteur par défaut légèrement relevée. **Menu secret supprimé entièrement** (bouton, Konami, touche ² et panneau).

## 2.0.0 — premium, saisons, HDRI
- **Codes premium à la Roblox** : 100 codes à usage unique (`RS2-XXXX-XXXX`) donnent **tous les cosmétiques** du jeu et un badge **PREMIUM** à côté du pseudo (classements, profil, amis, groupe). Un code par compte, réservé aux comptes. La liste de livraison est dans `docs/CODES.md` (à garder privée pour un vrai giveaway).
- **Saisons complètes** : Egg Hunt, Haunted Rails et Winter Fest, avec cosmétiques exclusifs, cadeaux d'événement et calendrier de l'avent. Les cadeaux utilisent une table `event_claims` : impossible de les réclamer deux fois.
- **HDRI Poly Haven (CC0)** : `public/hdri/kloofendal_48d_partly_cloudy_puresky_1k.hdr` éclaire et reflète les runners, planches et métaux via `scene.environment` ; le ciel visible reste le shader du jeu (jour/nuit, météo, biomes). Réglage **HDRI reflections** dans Graphismes, crédit dans `public/hdri/CREDITS.md`.
- **Backend 2.0.0** : premium dans les profils et classements, cadeaux d'événements idempotents, `/api/events` complet, blueprint Render, racine informative et CORS/WS configurables.
- **Tests** : `node tools/codes.mjs` et `node tools/events.mjs` couvrent les codes et les saisons (base temporaire).

## Jouer ensemble (1.4 → 1.6)
- **Carte de mode au-dessus de JOUER** : Limité (Neon Rush), Classé / Normal en **Solo, Duos, Trios**, modes hors ligne (Classique, Sans pièce, Daily), salle perso. On choisit, on appuie sur JOUER : plus de bouton « Online ». Anneau de chargement puis **Recherche → Préparation → Lancement**.
- **Groupes** jusqu'à 3, courses **2v2 / 3v3** par équipes (le total de l'équipe décide), les coéquipiers sont affichés en solide, les adversaires en fantômes. Un groupe reste toujours dans la même équipe.
- **MMR par échelle** (Solo, Duos, Trios) avec incertitude (les nouveaux bougent vite, fenêtre de recherche plus large), limite d'écart entre coéquipiers en classé, comptes liés jamais appariés.
- **Amis** (nom d'utilisateur ou code ami), présence en ligne / en file / en match, invitations de groupe ; **messages privés** entre amis (non-lus, blocage, signalement, filtre, limites de débit).
- **Tournois automatiques** : Sprint quotidien (17h–19h UTC) et Coupe hebdo (samedi 16h → dimanche 22h UTC), meilleur score Classic, récompenses versées automatiquement, cosmétiques exclusifs non achetables.
- **Cosmétiques** : tenues, planches, traînées + **sacs à dos, auras, styles de course, skins**.
- **Légal** : pages `/terms` et `/privacy` (modèles à faire relire par un juriste, à compléter avec l'exploitant), export des données et suppression de compte dans Paramètres.
- **13 langues** avec drapeaux (EN/FR écrits à la main, les autres traduites automatiquement par `tools/translate.mjs` vers `public/lang/*.json`), notes de version traduites.
- **Téléphones** : barre de navigation en bas en portrait, barre fine en paysage, zones sûres, champ de vision élargi en portrait.
- Tests : `node tools/social.mjs` (amis, groupes, équipes, MMR, messages, droits), `tournaments.mjs`, `cosmetics.mjs`, `modes.mjs` (2 navigateurs), `mobile.mjs`, `langshot.mjs`.

## Backend (`server/`, dépôt `sprayrun-backends`)
- **Comptes** (scrypt, invité → compte, sessions révocables, anti brute-force), **sauvegarde cloud** versionnée (l'économie n'en fait pas partie).
- **Économie côté serveur** : portefeuille, inventaire, prix, avent, XP/niveaux, succès ; pièces seulement via des parties validées (plafond quotidien).
- **Ranked** Elo (paliers Bronze→Champion) ; **il faut `RANKED_MIN_MINUTES` (15 par défaut) de temps de jeu** pour y accéder.
- **Anti-triche** : tickets signés à usage unique, plausibilité (vitesse, score, pièces, cadence d'entrées), télémétrie live (téléportation, retour arrière, hors limites), flags **durs** vs **statistiques**, avertissements → expulsion → bannissement avec preuves ; duel : déplacement/mur/vitesse/cadence de tir validés avec les mêmes règles que le client. *Ce n'est pas un rejeu déterministe : on ne peut pas promettre « aucun contournement ».*
- **Anti-VPN** (`ipintel.mjs`) : sorties Tor réelles, listes publiques de plages VPN/datacenter, fournisseur (ASN, FAI, drapeaux proxy/hosting via ip-api), **règle « marque ≠ vrai fournisseur »** (ProtonVPN, NordVPN, Mullvad, ExpressVPN… bloqués), fuseau horaire en signal faible. Les connexions résidentielles et mobiles passent ; liste blanche admin ; échec **ouvert** si le fournisseur est indisponible. *Limites : proxys résidentiels et serveurs VPN neufs peuvent passer.* Variables : `VPN_POLICY=block|flag|off`, `IPAPI_KEY` (offre pro d'ip-api, HTTPS), `TRUST_PROXY=1` derrière un reverse proxy.
- **Doubles comptes** (`devices.mjs`) : identifiant d'appareil persistant + empreinte (écran, GPU, canvas, audio, polices, fuseau, langue…) + réseau (IP et /24 hachés, ASN). Lien fort = même appareil, moyen = même empreinte + même réseau ; compte lié à un compte banni = *ban evasion* (exclusion + événement pour un modérateur, jamais de bannissement automatique) ; comptes liés jamais appariés en ranked ; 3 comptes max par appareil.
- **Contestations** : 3 maximum par compte, une à la fois ; au dépôt on choisit **Examen par IA (moins de 15 min)** ou **Examen humain (1 à 7 jours)** ; suivi horodaté dans le jeu + notification de la décision. L'IA ne peut annuler qu'une sanction fondée sur des preuves *statistiques* : preuves matérielles, sanctions de modérateur ou cas non concluants → humain.
- **Support** (assistant + escalade humaine) et **panel IA** : deux sièges indépendants (**OpenRouter** + **Token Harbor**, modèles gratuits), revue croisée en plusieurs tours, arbitre en cas de désaccord, cache, 0 token quand les règles suffisent, raisonnement désactivé (≈5-8× moins de tokens). Pas de Claude/Anthropic. Les modèles ne sont pas « entraînés » : le comportement vient des prompts, des schémas validés et des garde-fous serveur. Les offres gratuites ont des limites (60 req/min Token Harbor, 20 req/min OpenRouter) : tout a un repli.
- Admin (`ADMIN_KEY`, en-tête `X-Admin-Key`) : file de support, file de contestations, liens entre comptes, liste blanche VPN, ban/kick/déban.

## Tests (après `npx next build`)
```
node tools/backend.mjs      # REST, ranked, anti-triche (57)
node tools/duel-net.mjs     # serveur du duel : warp, tirs, triche, nul, badge, boost (23)
node tools/security.mjs     # VPN, ranked, doubles comptes, contestations, stats (39)
node tools/hub.mjs <dir>    # barre, boutique, avent, compte, support (21)
node tools/welcome.mjs <dir># accueil, langues, ranked, contestation, stats (18)
node tools/duel.mjs <dir>   # arène, Gold Eagle, bot, victoire/nul, warp solo (11)
node tools/perf.mjs         # GPU, résolution adaptative, stats d’images (22)
node tools/trains.mjs       # toits praticables, chocs, difficulté, bot pro sur le générateur dur
node tools/features.mjs · smoke.mjs . · online.mjs . · mp.mjs .
node tools/ai-panel.mjs     # panel IA réel (utilise .env)  ·  ai-probe.mjs · ai-tune.mjs
```
Le rendu de test est logiciel (SwiftShader) : lent, d'où des crashs forcés et des sauts de compte à rebours dans certains tests.

## Publication GitHub
`GITHUB_TOKEN=... node scripts/publish.mjs "message"` : jeu complet → `sprayrun-games`, backend (+ règles partagées `src/consts.js`, `src/arena.js`) → `sprayrun-backends`. Le jeton n'est jamais écrit sur le disque, chaque fichier est scanné (clés `.env`, jetons) avant commit. **Les deux dépôts sont publics** : le code anti-triche l'est donc aussi.

## Blender
`"C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" -b -P tools/blender/make_props.py -- public/models/props.glb`

## Structure
`app/`, `components/` Next.js 16 + Tailwind 4 · `src/` moteur Three.js, hub, duel, i18n · `server/` backend · `server.mjs` Next + API + WebSocket · `scripts/` dev:all, publication · `tools/` tests.
