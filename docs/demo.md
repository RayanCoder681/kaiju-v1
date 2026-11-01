# Scénario de démonstration reproductible

Déroulé complet, réalisable hors ligne sur le réseau local. Durée ≈ 10 min.

## Préparation

1. Utiliser **Node.js 22** (version indiquée dans `.nvmrc`; Node 20.11+ est aussi pris en charge). Vérifier avec `node -v`.
2. Première installation uniquement : `npm install`. Kaiju n'a pas besoin d'Internet une fois ses dépendances installées.
3. Depuis la racine du projet, lancer `npm run seed:demo` pour préparer une session [DÉMO] avec un quiz, un sondage et une Q&A. La commande affiche le code de session.
4. Lancer `npm start`. Noter l'URL LAN et autoriser Node.js sur le réseau privé si Windows le demande (§4 du guide Windows).

> Le seed crée le compte `demo` / `demo-kaiju-2026` uniquement si aucun compte organisateur n'existe déjà. Si un compte a déjà été configuré, connectez-vous avec ce compte. Ces identifiants fixes sont réservés à une démonstration locale.

### Démarrage rapide avec le seed

1. Sur l'ordinateur organisateur, ouvrir `http://localhost:4000/host` et se connecter.
2. Ouvrir la session `[DÉMO] TD Systèmes Distribués`, puis cliquer sur **Démarrer** pour passer de « En préparation » à « En direct ».
3. Garder cette page ouverte : elle affiche le code/QR, les participants et les commandes des activités. Ouvrir **Ouvrir la projection** sur l'écran de présentation.
4. Depuis un téléphone sur le même Wi-Fi, scanner le QR ou ouvrir l'URL LAN affichée, puis choisir un pseudonyme.
5. Démarrer le quiz préparé. Les participants répondent, puis l'organisateur clôture l'activité et publie les résultats sur la projection.
6. Recommencer avec le sondage puis la Q&A. Les participants peuvent envoyer des questions et voter.

Pour une répétition sans téléphone, ouvrir plusieurs fenêtres privées sur l'ordinateur et utiliser l'URL participant. Les résultats de ce mode ne remplacent pas un essai réel sur le Wi-Fi de la salle.

## Déroulé

1. **Lancement** — Le panneau de démarrage affiche l'URL LAN, le port et un QR d'accueil.
2. **Connexion organisateur** — Ouvrir `http://localhost:4000/host`, créer le compte (premier démarrage) ou se connecter. Le compte de démo est détaillé ci-dessus.
3. **Création de session** — « Démarrer maintenant » avec un titre, ou ouvrir la session [DÉMO] préparée par le seed. Le code et le QR s'affichent dans le détail de session.
4. **Projection** — « Ouvrir la projection » dans un onglet branché au vidéoprojecteur.
5. **Connexion de 2+ participants** — Sur deux smartphones (ou onglets privés), scanner le QR ou saisir le code, choisir un pseudonyme. Ils apparaissent dans la liste de présence de la console.
6. **Quiz chronométré** — Ajouter un quiz (ou utiliser celui de démo), « Démarrer ». Le minuteur tourne sur les 3 surfaces. Les participants répondent. À la fin (ou « Clôturer »), publier les résultats : la projection affiche l'histogramme et la bonne réponse.
7. **Sondage** — Ajouter/démarrer un sondage ; les résultats s'affichent selon la visibilité choisie (immédiate pour la démo).
8. **Q&A** — Ajouter/démarrer une Q&A : les participants posent des questions (anonymes possible) et votent ; l'organisateur modère et choisit ce qui va à la projection.
9. **Rapport & export** — Consulter le classement (individuel/équipe) ; télécharger l'export CSV et le bundle JSON.
10. **Déconnexion/reconnexion** — Fermer puis rouvrir l'onglet d'un participant : il se reconnecte avec son pseudonyme et ses réponses confirmées, sans doublon, sans pouvoir répondre tardivement.
11. **Sauvegarde/restauration** — Diagnostic → « Sauvegarder maintenant ». (Restauration : voir `docs/exploitation.md`.)
12. **Clôture** — Clôturer la session ; consulter le rapport final.

## Checklist d'acceptation (critères minimaux de livraison)

- [x] L'application démarre localement avec des instructions reproductibles.
- [x] Le serveur crée et conserve une session et ses activités dans SQLite.
- [x] Un participant rejoint par code/QR depuis un appareil sur le LAN (URL LAN, jamais localhost).
- [x] Quiz, sondage et Q&A fonctionnent réellement.
- [x] Les trois interfaces sont séparées et synchronisées en temps réel.
- [x] Scores, délais, permissions et visibilité contrôlés côté serveur.
- [x] Les réponses confirmées survivent à un rechargement/reconnexion et au redémarrage (reprise).
- [x] L'export produit des fichiers lisibles et validés (CSV/JSON).
- [x] Les tests exécutés et non exécutés sont rapportés honnêtement (voir `docs/rapport-tests.md`).
- [x] Aucune fonctionnalité incomplète n'est présentée comme terminée.

## Nettoyage des données de démo

Les éléments de démo sont préfixés « [DÉMO] ». Pour repartir d'une base vierge : arrêter le serveur,
supprimer `server/data/kaiju.sqlite*`, relancer. (Une suppression ciblée depuis l'UI peut aussi être
utilisée pour les vraies sessions.)
