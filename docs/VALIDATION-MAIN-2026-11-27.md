# Validation de main — 27 novembre 2026

La branche `suche-und-ausschluss` est intégrée à `main` avec la nouvelle recherche et l’extension complète. Aucun changement n’est resté uniquement sur cette branche. L’interface récente est conservée ; le suivi local lit maintenant les mêmes offres réelles que la recherche.

Vérifications effectuées :

- 98 tests réussis, types et confidentialité.
- Navigateur : recherche unique, critères persistants pour bouton et conversation, progression, plateformes et abwahl, liste et détail sur mobile, vraie vue de suivi, trois motifs d’archivage et exclusion de la même entreprise lors de la recherche suivante.
- Extension installée dans un navigateur isolé : profil JobPilot, réponses mémorisées, PDF ciblés, page ouverte ailleurs sans PDF, mode autonome après arrêt du serveur ; aucun envoi.
- Clone téléchargé depuis GitHub : `npm ci`, build, les 98 tests, types et confidentialité réussis. À l’installation : 21 plateformes, zéro offre fictive dans le suivi réel, profil initial vide et extension complète incluse.
- Les trois alertes npm constatées sur ce clone ont été corrigées avec `npm audit fix`, sans `--force`. Seul le verrouillage de dépendances a changé ; les tests ont été rejoués avec ce verrouillage. `npm audit` indique zéro vulnérabilité au moment du contrôle.

Les fichiers communs du catalogue, des règles de candidature, du moteur, du service worker, de la bulle, de la recherche et des pièces jointes ont été comparés avec la version privée. Les données et secrets de celle-ci ne sont pas fournis. Les tests utilisent des formulaires et marchés fictifs ; ils ne garantissent pas l’accès permanent à toutes les plateformes.

Installation : [guide français](INSTALLATION-FR.md). Le site GitHub Pages reste une démonstration séparée. Pour utiliser la vraie application, installer le dépôt et démarrer son serveur local.
