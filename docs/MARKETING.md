# Reverse Surfers - analyse marketing et produit

> Etat au 26 novembre 2026. Ce document decrit ce qui est mesure, comment le lire, et ce qui manque.
> Les chiffres de production ne sont pas dans ce depot : la source de verite est `/analytics` sur le backend
> (`ADMIN_KEY` requis), alimente par les evenements decrits plus bas. Aucun chiffre n'est invente ici.

## 1. Le modele economique actuel (constat)

- Le jeu est **gratuit**, sans achat reel : la boutique se paie en **pieces gagnees** en jouant.
- Il n'y a donc pas encore de revenu direct. Les KPI "conversion boutique" mesures ici sont de
  l'**engagement** (vue -> achat avec des pieces), pas un taux de conversion payant.
- Consequences : le cout d'acquisition doit rester proche de zero (organique, communaute), et la
  priorite est la retention et le bouche-a-oreille, pas le ROAS.
- Si une monnaie premium est ajoutee plus tard, il faudra un evenement `checkout_start`,
  `checkout_paid`, un identifiant de commande et une page de tarifs ; rien de tout cela n'existe aujourd'hui.

## 2. Ce que le jeu mesure deja

| Evenement | Ou | Ce qu'il repond |
|---|---|---|
| `visit` | une fois par session, au demarrage | volume de sessions, source (`document.referrer`), appareil, langue |
| `beat` | toutes les 25 s | duree de session, rebond |
| `run_start` / `run_end` | debut et fin de course | volume de parties, maps, modes, duree, raison de fin |
| `match_start` / `match_end` | matchmaking | adoption du multi, taille d'equipe, classement |
| `tutorial_done` | fin ou skip du tutoriel | activation |
| `mode_select` | choix d'un mode | interet pour les modes (Normal, Ranked, Duos/Trios, Explore) |
| `queue_start` / `queue_cancel` | recherche de partie | entonnoir du multi, abandons |
| `shop_view` | ouverture de la boutique (1/min max) | interet economique |
| `purchase` | achat reussi | consommation de pieces, articles desires |
| `perf` | echantillon de rendu | FPS moyen, 1 % low, preset, GPU, carte |

Le tableau de bord `/analytics` calcule en plus : DAU, WAU, parties par joueur, completion des courses,
tutoriel, conversion boutique, taux de match, retention D1/D7, cartes/modes, sources, appareils, langues,
et un entonnoir Visites -> Courses -> Courses finies -> File -> Match.

## 3. Entonnoir et cibles de travail

Les cibles ci-dessous sont des **seuils de travail** pour un petit jeu web, pas des promesses :

| Etape | Definition | Cible de depart | Si c'est bas |
|---|---|---|---|
| Visite -> course | `run_start / visit` | > 55 % | verifier le temps de chargement, le bouton PLAY, le tutoriel |
| Course -> fin | `run_end / run_start` | > 65 % | difficulte du premier kilometre, collisions, clarte des commandes |
| Tutoriel | `tutorial_done / visit` | > 70 % | raccourcir, rendre skippable, recompense visible |
| Visite -> multi | `match_start / visit` | > 10 % | mettre le mode au-dessus de PLAY, reduire l'attente |
| File -> match | `match_start / queue_start` | > 80 % | fenetre de MMR, population, modes trop divises |
| Boutique | `purchase / shop_view` | > 8 % | prix, art des objets, objets utiles en jeu |
| D1 | retour le lendemain | > 20 % | missions quotidiennes, tournoi du jour, ami qui invite |
| D7 | retour dans la semaine | > 8 % | progression, saison, evenements |

Un entonnoir se lit **de haut en bas** : corriger l'etape qui perd le plus de monde rapporte plus qu'optimiser
une etape deja bonne. Les pourcentages doivent etre filtres par source et par appareil avant toute conclusion.

## 4. Diagnostic produit

### Forces
- **13 langues** avec drapeaux, texte traduit ; l'anglais et le francais sont ecrits a la main.
- **Multi social** : amis, groupes jusqu'a 3, 2v2/3v3, MMR par echelle, messages prives.
- **Deux evenements** et des tournois automatiques (Sprint quotidien, Coupe hebdomadaire).
- **Trois presets graphiques** et resolution adaptative : le jeu peut tourner sur un portable modeste.
- **Mobile** : navigation basse en portrait, zones sures, champ de vision elargi.
- **Mesure respectueuse** : opt-out dans les reglages, IP supprimee apres 30 jours, evenements 90 jours.

### Risques et angles morts
1. **Assets** : les GLB extraits de Subway Surfers (`Assets/`, `Rio.glb`) ne sont pas publies. Les integrer
   exposerait les depots GitHub et l'hebergement a une reclamation. Il faut des modeles originaux ou sous licence.
2. **Pas de revenu** : pas de paiement, pas de publicite, pas de battle pass. C'est un choix, mais il faut
   le savoir avant de calculer un CAC.
3. **Acquisition non instrumentee** : `document.referrer` ne suffit pas. Ajouter des liens `?utm_source=`
   et enregistrer la campagne dans `visit` pour comparer TikTok, YouTube Shorts, Discord, Reddit.
4. **Population** : le matchmaking est bon techniquement, mais un jeu vide ne matche personne. Lancer des
   **creneaux** (19h-21h locales) et afficher "X joueurs en ligne" pour concentrer la demande.
5. **Tutoriel / premiere partie** : la premiere minute decide de la retention. Mesurer le point d'abandon
   (distance, obstacle, mode) et non seulement "fini / pas fini".
6. **Performance mobile** : le 1 % low compte plus que le FPS moyen. Si le 1 % low est sous 30, reduire
   les particules et les ombres avant d'ajouter du contenu.
7. **Confidentialite** : la page `/privacy` et l'export/suppression existent ; garder l'IP 30 jours et
   documenter tout nouveau traitement.

## 5. Plan d'acquisition a cout nul

1. **Vertical video** : 15-20 s de gameplay, un obstacle lisible, un score. Un format par carte
   (Palm Bay, Neon, montagne, mesa) et un par mode (Roof run, Duos, Neon Rush). Poster 3 fois par semaine,
   pas tous les jours.
2. **Discord et communaute** : un salon `#looking-for-group`, un code de room partageable, un tournoi
   hebdomadaire annonce a l'avance. Le lien de room est le meilleur invit viral.
3. **Reddit / itch.io / web game portals** : une page courte, 6 captures, une build jouable, pas de
   telechargement. Mesurer `ref` et `utm_source`.
4. **Ecoles / amis** : le mode 3v3 et les groupes sont faits pour ca ; simplifier l'invitation par lien.
5. **SEO minimal** : une page par evenement/mode avec un titre clair, pas de ferme de pages.

## 6. Plan de retention

- **Boucle quotidienne** : Daily Run + Sprint quotidien + calendrier de l'avent en decembre.
  Recompense visible des la connexion, pas cachee dans un menu.
- **Boucle hebdomadaire** : Coupe du samedi, classement, cosmetique exclusif. Afficher le temps restant.
- **Boucle sociale** : un ami en ligne = une invitation a un groupe ; statut "en partie" deja present.
- **Progression** : niveaux, missions, badges. Les missions "toits" sont de nouveau actives avec les
  trains praticables ; verifier qu'elles ne sont pas bloquees par la difficulte.
- **Retour** : un joueur absent depuis 7 jours devrait retrouver un evenement et un cadeau, pas une page vide.

## 7. Experiences a mener (une a la fois, 2 semaines)

| Hypothese | Variante A | Variante B | Metrique |
|---|---|---|---|
| Le tutoriel est trop long | 6 etapes (actuel) | 4 etapes + recompense | `tutorial_done / visit`, `run_end` |
| Le mode au-dessus de PLAY est ignore | carte de mode actuelle | mode aleatoire mis en avant | `run_start / visit`, `mode_select` |
| Les parties sont trop dures | difficulte actuelle | premiere course 20 % plus lente | `run_end / run_start`, distance mediane |
| Le shop ne convertit pas | prix actuels | objet a 500 pieces en avant | `purchase / shop_view` |
| L'attente multi rebute | file actuelle | compte a rebours + "X en ligne" | `match_start / queue_start` |

Regle : ne pas lancer deux experiences qui touchent le meme ecran en meme temps. Garder chaque variante
au moins 7 jours et comparer par source, pas seulement en global.

## 8. Lecture hebdomadaire du dashboard (15 minutes)

1. **DAU / WAU** et nombre de nouveaux : la croissance vient-elle de nouvelles sessions ou d'un retour ?
2. **Entonnoir** : l'etape qui perd le plus de monde cette semaine.
3. **D1 / D7** par source : une source qui amene des joueurs qui ne reviennent pas coute du temps.
4. **Courses finies** par carte et par mode : une carte qui fait abandonner plus que les autres a un probleme.
5. **1 % low** par preset et par carte : la qualite percue avant d'ajouter des effets.
6. **Boutique** : vues, achats, objets les plus achetes, solde de pieces. Un objet jamais achete est mal place,
   trop cher, ou inutile.
7. **Multi** : `queue_start` -> `match_start`, taille des groupes, heures de pointe. Concentrer les evenements
   sur les heures observees, pas sur une intuition.

## 9. Ce qui manque pour une analyse "marketing" complete

- **Donnees de production** : le dashboard doit tourner sur le backend Render/Railway avec `ADMIN_KEY`
  et un disque persistant, sinon la base est vide a chaque deploiement.
- **Attribution** : liens UTM, campagne stockee dans `visit`, cout par campagne (meme manuel).
- **Revenu** : aucun checkout aujourd'hui ; sans lui, pas de LTV, pas de ROAS, pas de CAC payable.
- **Cohortes** : la retention est calculee par jour, pas encore par cohorte de premiere visite. A ajouter
  quand le volume le justifiera (au moins 100 nouveaux joueurs/semaine).
- **Qualite** : crashes JS et erreurs reseau ne sont pas encore remontes comme evenements dedies.

## 10. Priorites

1. Rendre le backend stable et persistant (Render paid disk ou Railway/Fly), avec `CORS_ORIGIN` et
   `TRUST_PROXY=1`.
2. Publier uniquement des assets originaux ; garder `Assets/` et `Rio.glb` hors des depots.
3. Instrumenter les campagnes (UTM) et vérifier l'entonnoir sur de vraies donnees.
4. Optimiser la premiere minute (chargement, tutoriel, premiere course) avant d'ajouter du contenu.
5. Concentrer le multi sur des creneaux et inviter par lien de room.
6. Seulement ensuite : monnaie premium, battle pass ou cosmetiques payants, avec un vrai checkout.
