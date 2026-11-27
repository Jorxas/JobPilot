# Installer JobPilot sur son ordinateur

## Recherche gratuite

Installer Node.js 22.12 ou une version plus récente, puis télécharger et extraire le dépôt. Dans un terminal ouvert à la racine du projet :

```powershell
npm ci
npm run build
$env:JOBPILOT_LIVE = '1'
npm start
```

Sur macOS ou Linux, remplacer les deux dernières lignes par `JOBPILOT_LIVE=1 npm start`.

Ouvrir http://127.0.0.1:3037/offres, choisir ses critères, puis cliquer sur **Suchen**. Garder le serveur en marche. L'activation seule ne lance aucune recherche ; le bouton déclenche un seul cycle de cinq passages. L'API `GET /api/suche` doit indiquer `live: true`. Si un serveur tourne déjà sans recherche réelle, l'arrêter avec Ctrl+C, puis le relancer avec cette variable.

`npm ci` installe le premier moteur Indeed, ts-jobspy. La recherche gratuite ne demande ni extension, ni MCP, ni compte ChatGPT ou Claude. Les sources bloquées ou indisponibles restent signalées ; aucun résultat complet n'est garanti. Le site GitHub Pages est une démonstration avec des données fictives.

## Suivi et exclusion des entreprises

**Stellensuche affiche seulement les nouvelles offres du jour.** Plusieurs recherches dans la journée complètent cette liste. Au changement de jour, selon l’heure de Berlin, les résultats quittent cette page, même si elle reste ouverte. Toutes les offres précédentes et leurs PDF restent conservés dans **Stellenübersicht**, accessible depuis le lien de la recherche. Aucun archivage ou effacement automatique.

Les offres trouvées sont aussi visibles sur http://127.0.0.1:3037/suivi. Le bouton **Archiviert** demande un des trois motifs. Seul **Kein IT-Bezug** (« pas informatique ») exclut définitivement l’entreprise des recherches suivantes. Les deux autres motifs archivent seulement l’offre. L’historique et les PDF restent conservés. Les critères enregistrés, les plateformes cochées et la recherche lancée depuis une conversation utilisent la même API locale que le bouton. Aucun deuxième lancement n’est effectué si une recherche tourne déjà.

## Extension pour remplir les formulaires

Elle est incluse dans le dépôt sous **`public/erweiterung/`**. Elle est facultative pour la recherche et son installation n'est pas automatique.

1. Ouvrir `edge://extensions` dans Edge ou `chrome://extensions` dans Chrome.
2. Activer le mode développeur, puis **Charger l'extension non empaquetée**.
3. Choisir le dossier `public/erweiterung/` contenant `manifest.json` et conserver ce dossier sur l'ordinateur.
4. Recharger l’extension, puis recharger JobPilot si son onglet était déjà ouvert. Après chaque mise à jour, recharger aussi les onglets employeur.

**Avec JobPilot :** ouvrir http://127.0.0.1:3037/profile et enregistrer son propre profil. Depuis une offre réelle, choisir **Unterlagen vorbereiten**, ajouter les PDF ciblés de cette candidature et les enregistrer. **Mit Assistent öffnen (neuer Tab)** ouvre la page employeur et sa bulle JP. Cliquer sur **Bekannte Felder ausfüllen** pour remplir les champs et joindre les PDF de cette candidature. Les réponses enregistrées dans la bulle restent dans son JobPilot local. Garder l’onglet JobPilot ouvert.

**Une page ouverte ailleurs, avec ses données JobPilot :** dans le popup, choisir **Remplir cette page avec mes données JobPilot**. La même bulle et les réponses mémorisées sont disponibles, sans PDF tant que la page n’est pas associée à une candidature.

**Sans JobPilot ouvert ou démarré :** dans le popup, renseigner **Mon profil**, ou importer son propre export, puis choisir **Remplir automatiquement**. Les réponses peuvent être mémorisées et les PDF ciblés sélectionnés dans le popup. Aucun serveur n’est nécessaire pour ce mode autonome. Les données du popup sont une autre copie locale ; exporter/importer son profil pour les transférer entre les deux modes.

Les deux modes utilisent les mêmes composants que l’extension privée, avec ses propres données. Aucune donnée du créateur n’est fournie. Chacun vérifie les champs et clique lui-même sur Envoyer. LinkedIn et Indeed restent exclus du remplissage : ouvrir le formulaire employeur. La démonstration en ligne garde ses boutons d’assistant désactivés. Le navigateur peut bloquer certains formulaires ou cadres ; ne pas promettre que tous fonctionneront.

Le manifeste reconnaît JobPilot sur le port 3037. Si l’agent change le port, il doit mettre à jour les deux adresses de `content_scripts[0].matches` dans `public/erweiterung/manifest.json`, puis faire recharger l’extension et la page JobPilot. Détails : [Formularassistent](FORMULARASSISTENT.md).

## Secours Indeed avec ses propres comptes

Ces secours sont facultatifs : la recherche gratuite reste disponible sans eux. Le propriétaire du compte doit installer et connecter son propre Codex CLI ou Claude Code et le connecteur Indeed correspondant. Les procédures et variables `JOBPILOT_INDEED_CODEX` et `JOBPILOT_INDEED_CLAUDE` sont dans la [README](../README.md#indeed-kostenloser-erstabruf-und-ersatzwege). Aucune connexion de compte n'est effectuée automatiquement. Claude peut consommer le quota de son abonnement. Aucun chat n'a besoin de rester ouvert ; le serveur local et les connexions doivent être disponibles.

## Consignes pour l'agent qui accompagne l'installation

Lire `AGENTS.md`, ce guide et la README avant de guider la personne. Distinguer la recherche locale réelle, la démonstration et l'extension de formulaire. Vérifier les prérequis et `GET /api/suche` ; ne pas lancer une recherche pour seulement tester l'installation. Ne pas promettre d'installation automatique de l'extension ou des comptes. Expliquer les étapes manuelles de navigateur et laisser la personne gérer ses connexions. Ne jamais copier les données ou accès du créateur. Après un démarrage de recherche non confirmé, consulter `GET /api/status` avant toute nouvelle tentative.
