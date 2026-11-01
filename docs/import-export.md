# Importer et exporter des données

## Importer des questions en lot

Dans **Bibliothèque**, téléchargez le modèle « Questions CSV », remplissez une question par ligne, puis importez le fichier. Le séparateur de colonnes est `;`. Les champs contenant ce séparateur, des guillemets ou des retours à la ligne doivent être entre guillemets doubles (un guillemet interne s’écrit `""`).

| Colonne | Format |
| --- | --- |
| `titre` | Nom de l’activité; facultatif, reprend la question si vide |
| `question` | Texte de la question |
| `choix` | Réponses séparées par `|`; au moins deux pour `single` et `multiple` |
| `bonne_reponse` | Numéro(s) de réponse à partir de 1; plusieurs numéros séparés par `|` |
| `format` | `single`, `multiple` ou `truefalse` |
| `duree_s` | Durée en secondes; 30 par défaut |
| `explication` | Facultative |
| `langue` | `fr` ou `en`; `fr` par défaut |

Exemple : `"Quiz 1";"Combien font 2 + 2 ?";"3|4|5";2;single;20;"";fr`.
Les lignes valides sont ajoutées à la bibliothèque; les doublons et erreurs sont retournés avec leur numéro de ligne. La taille maximale est de 2 Mo.

## Exporter puis réimporter les résultats d’une session

L’export CSV des résultats est un tableau de scores destiné à l’analyse dans un tableur. Il ne contient pas toutes les réponses ni les données Q&A et ne peut donc pas restaurer une session.

Pour transférer ou archiver une session complète, exportez l’archive **CSV ou JSON** depuis la session, puis choisissez le fichier dans le tableau de bord. Les deux formats préservent le même format `kaiju.session-bundle` version 2 : participants, équipes, activités, réponses brutes, questions/votes Q&A, réponses ouvertes et réglages. Le CSV d’archive est un CSV technique à une colonne contenant le bundle JSON; il est fait pour l’échange et l’import en lot. Le CSV « résultats » reste un tableau lisible dans un tableur.

L’import crée une nouvelle session clôturée et remappe les identifiants; les jetons de reconnexion ne sont pas exportés. La session archivée reste consultable et ses résultats sont préservés.

Les fichiers d’activités JSON de la bibliothèque restent un format distinct : ils ne transfèrent que les définitions de questions/activités, sans participants ni résultats.

Les archives JSON sont limitées à 25 Mo et le CSV technique à 50 Mo. Les imports sont réservés à l’organisateur authentifié.
