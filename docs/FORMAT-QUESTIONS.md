# Format des questions AGExam

Ce format sert à écrire les questions d'un examen dans la zone de texte, ou dans un fichier `.txt` à importer.

## Exemple

````text
Q: Quelle structure répète un bloc tant qu'une condition est vraie ?
A) Si … Alors
B) TantQue … Faire *
C) Selon … Faire
D) Aucune des réponses
DUREE: 30s

Q: Quelles instructions ajoutent un élément à la fin d'une liste Python ?
A) liste.append(x) *
B) liste.add(x)
C) liste.insert(len(liste), x) *
DUREE: 1min
POINTS: 2

Q: Quelle valeur affiche l'algorithme suivant ?
```pseudo
s ← 0
Pour i ← 1 à 5 Faire
    Si i Mod 2 = 0 Alors
        s ← s + i
    FinSi
FinPour
Écrire(s)
```
A) 6 *
B) 9
C) 15
DUREE: 1min30
EXPLICATION: Seuls 2 et 4 sont pairs : 2 + 4 = 6.
````

## Règles

| Élément                  | Écriture                          | Remarque                                                                               |
| ------------------------ | --------------------------------- | -------------------------------------------------------------------------------------- |
| Début de question        | `Q:`, `Question 3:`, `3.` ou `3)` | Une ligne vide sépare les questions. L'énoncé peut tenir sur plusieurs lignes.         |
| Réponses                 | `A)`, `A.`, `a)`, `A -`           | De 2 à 10 réponses. Une réponse peut continuer sur la ligne suivante.                  |
| Bonne réponse            | `*` en fin de ligne               | Plusieurs `*` = QCM à plusieurs réponses (cases à cocher).                             |
| Bonne réponse (variante) | `REPONSE: B` ou `REPONSES: A, C`  | Format Moodle « Aiken » (`ANSWER: B`) accepté.                                         |
| Code                     | entre ` ``` ` et ` ``` `          | Avant les réponses. Langage facultatif : `pseudo`, `python`, `sql`, `js`, `c`, `java`. |
| Durée                    | `DUREE: 30s`                      | Aussi : `45`, `1min`, `1min30`, `1:30`, `2 minutes`. Entre 5 s et 30 min.              |
| Points                   | `POINTS: 2`                       | 1 par défaut. Décimales acceptées (`1,5`).                                             |
| Explication              | `EXPLICATION: …`                  | Affichée dans la correction complète.                                                  |
| Type                     | `TYPE: trace`                     | Facultatif : `qcm`, `multiple`, `vf`, `trace`, `erreur`, `complexite`.                 |

## Ce qui est automatique

- **Type** : vrai/faux si les réponses sont « Vrai » et « Faux » ; plusieurs réponses si plusieurs `*` ; trace d'algorithme s'il y a du code ; QCM sinon.
- **Durée suggérée** si `DUREE` est absente : 30 s (vrai/faux), 1 min 30 (code), 1 min (plusieurs réponses), 45 s (autres), +15 s si l'énoncé est long.
- **Réponses fixes** : « Aucune des réponses… », « Toutes les réponses… », « A et B » restent à leur place quand l'ordre des réponses est mélangé.

## Fichier Excel

Une ligne par question. Colonnes reconnues (l'ordre n'a pas d'importance) :

`Question` · `Code` · `Langage` · `A` · `B` · `C` · `D` (jusqu'à `J`) · `Bonne réponse` (`B` ou `A, C`) · `Durée` · `Points` · `Explication`

Le modèle se télécharge depuis l'éditeur d'examen (bouton « Modèle Excel »). Le fichier est converti en texte au format ci-dessus, que l'on peut ensuite retoucher avant d'enregistrer.
