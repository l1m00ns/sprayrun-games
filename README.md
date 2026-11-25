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
Base SQLite dans `data/` (`DATA_DIR`). Node ≥ 22.13. Le client parle à son propre serveur par défaut. **Backend ailleurs (Render, Railway…)** : `NEXT_PUBLIC_BACKEND_URL=https://ton-service.onrender.com` dans le `.env` du front (figé au `npm run build`), ou `public/config.js` pour changer sans reconstruire ; côté backend `CORS_ORIGIN=https://ton-front` et `TRUST_PROXY=1`. La version s’affiche dans Paramètres (`1.3.1-<commit>`).

## Jeu
- **5 cartes + World Tour**, météo, jour/nuit, scènes animées, **graffitis**, animation de départ. **Palm Bay** refaite : mer animée (reflets, écume), ponton, bar tiki, filet de volley, serviettes, pirogue, bouées, palmiers penchés.
- **Trains pleins** : on ne marche plus sur les toits (plus de rampes), toucher un toit en retombant = crash ; wagons plus nombreux et plus longs (jusqu’à 4), **couloirs** (slalom, enchaînements saut/roulade entre deux murs), écarts qui se resserrent et deuxième palier de difficulté après ~4,5 km ; vitesse plafond ×1,6. Les chocs ont leur animation (trébuchement, coup latéral, tête cognée, projection en arrière + étoiles + arrêt sur image).
- **Rio** (héros original : casquette, doudoune) + 12 coureurs, tenues, planches et traînées (boutique).
- **Vitesse progressive** : la rampe authentique (110→220) continue ensuite vers ×1,4 ; **commandes « snappy »** (changement de voie 0,13 s, entrées appliquées instantanément) ou « classiques » (0,27 s).
- **Gold Rush Duel** (mode limité) : en pleine course la piste se transforme en **arène FPS** fermée avec le pistolet doré **Gold Eagle** (recul, culasse, douilles, rechargement, visée). Le duel arrive à un **moment aléatoire, au moins une fois par partie** ; **le premier à toucher tue** (headshot 72, corps 34, jambes 22, une seule vie) ; 2:00 écoulées = **égalité**. Le vainqueur gagne un **badge de profil la première fois**, ensuite **8 s de boost de vitesse + une seconde vie, pièces désactivées pendant ces 8 s**. Après le duel la course **reprend**. Duel en ligne validé par le serveur ; bot d'entraînement hors ligne (5 niveaux).
- **Menu secret Spray** (code Konami, puis touche **²** pour l’ouvrir/fermer partout, même en course) : recherche, compteurs par onglet, bouton **UNLOAD** (tout désactiver pour rejouer en ligne), 68 options (joueur, pouvoirs, vitesse, bot pro, monde, look, caméra, duel, outils). Toute option qui change le gameplay rend la session « entraînement » : rien n'est enregistré, envoyé ni classé, le jeu en ligne est bloqué. Bot pro à planificateur (survit 10/10 parties de 100 s sans invincibilité).
- **Winter Fest** (1er déc → 6 janv., horloge UTC identique pour tous) et **calendrier de l'avent** de 25 portes (récompenses côté serveur).
- **Langues** : bouton 🌐 + écran d'accueil à la première visite (langue, apparence, commandes/caméra, fair-play & vie privée, compte). Anglais et français (traduction en direct de toute l'interface ; ajouter une langue = un dictionnaire dans `src/i18n.js`).
- **Interface** : barre supérieure (Jouer, Boutique, Carrière, Classement, Événements, Mises à jour, Support), profil, **statistiques** en graphiques, **paramètres** (≈35 options : graphismes, caméra, commandes, audio, accessibilité), aucune pop-up navigateur (dialogues natifs), scrollbars masquées.

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
node tools/secret.mjs       # Konami, 67 options, isolation entraînement, bot pro (14)
node tools/duel.mjs <dir>   # arène, Gold Eagle, bot, victoire/nul, warp solo (11)
node tools/perf.mjs         # GPU, résolution adaptative, stats d’images (22)
node tools/trains.mjs       # trains pleins, chocs, difficulté, bot pro sur le générateur dur (14)
node tools/features.mjs · smoke.mjs . · online.mjs . · mp.mjs .
node tools/ai-panel.mjs     # panel IA réel (utilise .env)  ·  ai-probe.mjs · ai-tune.mjs
```
Le rendu de test est logiciel (SwiftShader) : lent, d'où des crashs forcés et des sauts de compte à rebours dans certains tests.

## Publication GitHub
`GITHUB_TOKEN=... node scripts/publish.mjs "message"` : jeu complet → `sprayrun-games`, backend (+ règles partagées `src/consts.js`, `src/arena.js`) → `sprayrun-backends`. Le jeton n'est jamais écrit sur le disque, chaque fichier est scanné (clés `.env`, jetons) avant commit. **Les deux dépôts sont publics** : le code anti-triche l'est donc aussi.

## Blender
`"C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" -b -P tools/blender/make_props.py -- public/models/props.glb`

## Structure
`app/`, `components/` Next.js 16 + Tailwind 4 · `src/` moteur Three.js, hub, duel, i18n, menu secret · `server/` backend · `server.mjs` Next + API + WebSocket · `scripts/` dev:all, publication · `tools/` tests.
