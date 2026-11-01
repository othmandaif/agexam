/**
 * Algorithmes du tutoriel AGSyntax (tutoriel/lecons.py, dernière version) :
 * référence de comportement de l'interpréteur. `faux` : volontairement
 * incorrect (l'exécution doit échouer ou être détectée).
 */
export interface LessonFixture {
  title: string;
  code: string;
  inputs?: string[];
  faux?: boolean;
}

export const LESSONS: LessonFixture[] = [
  {
    title: "Comment travailler avec AGSyntax",
    code: `ALGORITHME PrendreEnMain

VARIABLES
  compteur : ENTIER

DEBUT
  compteur <- 0
  compteur <- compteur + 5
  compteur <- compteur * 2
  ECRIRE("Le compteur vaut ", compteur)
FIN
`,
  },
  {
    title: "La structure d'un algorithme",
    code: `ALGORITHME PremierAlgorithme
// Tout ce qui suit deux barres obliques est ignore par la machine

DEBUT
  ECRIRE("Bonjour")
  ECRIRE("Je suis un algorithme")
  ECRIRE("Je m execute ligne par ligne")
FIN
`,
  },
  {
    title: "ECRIRE ou AFFICHER : le retour à la ligne",
    code: `ALGORITHME EcrireOuAfficher

VARIABLES
  prenom : CHAINE
  i : ENTIER

DEBUT
  AFFICHER("Ton prenom : ")
  LIRE(prenom)
  ECRIRE("Bonjour ", prenom)

  SAUTLIGNE

  // Construire une ligne morceau par morceau
  AFFICHER("Comptons : ")
  POUR i DE 1 A 5 FAIRE
    AFFICHER(i)
    AFFICHER(" ")
  FINPOUR
  ECRIRE("... termine")

  // La meme boucle avec ECRIRE : une ligne par nombre
  POUR i DE 1 A 3 FAIRE
    ECRIRE("Ligne ", i)
  FINPOUR
FIN
`,
    inputs: ["Yasmine"],
  },
  {
    title: "ECRIRE : afficher plusieurs choses",
    code: `ALGORITHME AfficherPlusieursChoses

VARIABLES
  age : ENTIER

DEBUT
  age <- 19
  ECRIRE("age")
  ECRIRE(age)
  ECRIRE("Tu as ", age, " ans")
  ECRIRE("L annee prochaine tu auras ", age + 1, " ans")
FIN
`,
  },
  {
    title: "Déclarer une variable",
    code: `ALGORITHME DeclarerDesVariables

VARIABLES
  nombreEleves : ENTIER
  moyenne : REEL
  nomClasse : CHAINE
  estValide : BOOLEEN

DEBUT
  // Avance pas a pas : au debut, toutes les variables valent ?
  nombreEleves <- 24
  moyenne <- 12.75
  nomClasse <- "DD101"
  estValide <- VRAI

  ECRIRE("Classe ", nomClasse, " : ", nombreEleves, " stagiaires")
  ECRIRE("Moyenne : ", moyenne)
FIN
`,
  },
  {
    title: "Les constantes",
    code: `ALGORITHME FactureClient

CONSTANTES
  TVA = 0.10 : REEL
  REMISE = 0.05 : REEL

VARIABLES
  prixHT, quantite, total : REEL

DEBUT
  AFFICHER("Prix hors taxes : ")
  LIRE(prixHT)
  AFFICHER("Quantite : ")
  LIRE(quantite)

  total <- prixHT * quantite
  total <- total * (1 + TVA)
  total <- total * (1 - REMISE)

  ECRIRE("Montant a payer : ", total)
FIN
`,
    inputs: ["200", "3"],
  },
  {
    title: "L'affectation : la flèche",
    code: `ALGORITHME ComprendreLaFleche

VARIABLES
  a, b, temporaire : ENTIER

DEBUT
  a <- 10
  b <- 3

  a <- a + b        // a recoit 13
  b <- a * 2        // b recoit 26

  // Echanger deux variables : le grand classique
  temporaire <- a
  a <- b
  b <- temporaire

  ECRIRE("a = ", a, "   b = ", b)
FIN
`,
  },
  {
    title: "LIRE : demander une valeur",
    code: `ALGORITHME CalculerUnPrixTTC

VARIABLES
  prixHT, tva, prixTTC : REEL

DEBUT
  AFFICHER("Prix hors taxes : ")
  LIRE(prixHT)

  tva <- prixHT * 0.20
  prixTTC <- prixHT + tva

  ECRIRE("TVA    : ", tva)
  ECRIRE("Prix TTC : ", prixTTC)
FIN
`,
    inputs: ["150"],
  },
  {
    title: "La trace d'exécution : le rituel",
    code: `ALGORITHME TracerAlaMain

VARIABLES
  x, y, z : ENTIER

DEBUT
  x <- 4
  y <- x + 3
  z <- y - x
  x <- z * y
  y <- x MOD 5
  z <- x + y + z
FIN
`,
  },
  {
    title: "Les opérateurs et leurs priorités",
    code: `ALGORITHME PrioriteDesOperateurs

VARIABLES
  a, b : REEL
  sansParenthese, avecParenthese : REEL

DEBUT
  a <- 10
  b <- 20

  sansParenthese <- a + b / 2
  avecParenthese <- (a + b) / 2

  ECRIRE("Sans parentheses : ", sansParenthese)
  ECRIRE("Avec parentheses : ", avecParenthese)
  ECRIRE("2 puissance 10 = ", 2 ^ 10)
FIN
`,
  },
  {
    title: "DIV et MOD : la division entière",
    code: `ALGORITHME DecomposerUneDuree

VARIABLES
  totalSecondes, heures, minutes, secondes : ENTIER

DEBUT
  totalSecondes <- 7385

  heures   <- totalSecondes DIV 3600
  minutes  <- (totalSecondes MOD 3600) DIV 60
  secondes <- totalSecondes MOD 60

  ECRIRE(totalSecondes, " secondes = ",
         heures, "h ", minutes, "min ", secondes, "s")
FIN
`,
  },
  {
    title: "Les fonctions prédéfinies",
    code: `ALGORITHME UtiliserLesFonctions

VARIABLES
  x : REEL
  n : ENTIER

DEBUT
  x <- 2.7
  ECRIRE("Racine de 144 : ", RACINE(144))
  ECRIRE("Valeur absolue de -8 : ", ABS(-8))
  ECRIRE("Partie entiere de 2.7 : ", ENT(x))
  ECRIRE("Arrondi de 2.7 : ", ARRONDI(x))

  n <- ALEA(1, 6)
  ECRIRE("Lance de de : ", n)
FIN
`,
  },
  {
    title: "SI … ALORS … FINSI",
    code: `ALGORITHME VerifierUneNote

VARIABLES
  note : REEL

DEBUT
  AFFICHER("Ta note sur 20 : ")
  LIRE(note)

  SI note >= 10 ALORS
    ECRIRE("Admis")
  FINSI

  ECRIRE("Fin du controle")
FIN
`,
    inputs: ["14"],
  },
  {
    title: "SI … SINON : deux chemins",
    code: `ALGORITHME PairOuImpair

VARIABLES
  n : ENTIER

DEBUT
  AFFICHER("Donne un entier : ")
  LIRE(n)

  SI n MOD 2 = 0 ALORS
    ECRIRE(n, " est pair")
  SINON
    ECRIRE(n, " est impair")
  FINSI
FIN
`,
    inputs: ["7"],
  },
  {
    title: "Conditions imbriquées",
    code: `ALGORITHME SigneDUnNombre

VARIABLES
  n : ENTIER

DEBUT
  AFFICHER("Donne un entier : ")
  LIRE(n)

  SI n > 0 ALORS
    ECRIRE(n, " est positif")
  SINON
    SI n < 0 ALORS
      ECRIRE(n, " est negatif")
    SINON
      ECRIRE(n, " est nul")
    FINSI
  FINSI
FIN
`,
    inputs: ["-4"],
  },
  {
    title: "Conditions imbriquées : beaucoup de cas",
    code: `ALGORITHME MentionDuBac

VARIABLES
  note : REEL

DEBUT
  AFFICHER("Moyenne : ")
  LIRE(note)

  SI note < 10 ALORS
    ECRIRE("Ajourne")
  SINON
    SI note < 12 ALORS
      ECRIRE("Passable")
    SINON
      SI note < 14 ALORS
        ECRIRE("Assez bien")
      SINON
        SI note < 16 ALORS
          ECRIRE("Bien")
        SINON
          ECRIRE("Tres bien")
        FINSI
      FINSI
    FINSI
  FINSI
FIN
`,
    inputs: ["15"],
  },
  {
    title: "ET, OU, NON",
    code: `ALGORITHME ControlerUnAcces

VARIABLES
  age : ENTIER
  aUnBillet : BOOLEEN

DEBUT
  age <- 16
  aUnBillet <- VRAI

  SI age >= 18 ET aUnBillet ALORS
    ECRIRE("Entree autorisee")
  SINON
    ECRIRE("Entree refusee")
  FINSI

  SI age < 12 OU age > 65 ALORS
    ECRIRE("Tarif reduit")
  SINON
    ECRIRE("Tarif plein")
  FINSI

  SI NON aUnBillet ALORS
    ECRIRE("Passe en caisse")
  FINSI
FIN
`,
  },
  {
    title: "POUR : répéter un nombre connu de fois",
    code: `ALGORITHME TableDeMultiplication

VARIABLES
  base, i : ENTIER

DEBUT
  AFFICHER("Table de : ")
  LIRE(base)

  POUR i DE 1 A 10 FAIRE
    ECRIRE(base, " x ", i, " = ", base * i)
  FINPOUR
FIN
`,
    inputs: ["7"],
  },
  {
    title: "Compteur et accumulateur",
    code: `ALGORITHME MoyenneEtNotesAdmises

VARIABLES
  n, i, admises : ENTIER
  note, somme : REEL

DEBUT
  AFFICHER("Combien de notes ? ")
  LIRE(n)

  somme <- 0        // accumulateur
  admises <- 0      // compteur

  POUR i DE 1 A n FAIRE
    AFFICHER("Note ", i, " : ")
    LIRE(note)
    somme <- somme + note
    SI note >= 10 ALORS
      admises <- admises + 1
    FINSI
  FINPOUR

  ECRIRE("Moyenne : ", somme / n)
  ECRIRE("Notes >= 10 : ", admises, " sur ", n)
FIN
`,
    inputs: ["4", "12", "8", "15", "9"],
  },
  {
    title: "TANT QUE : répéter tant qu'une condition tient",
    code: `ALGORITHME SommeJusquaZero

VARIABLES
  valeur, somme, combien : ENTIER

DEBUT
  somme <- 0
  combien <- 0

  ECRIRE("Saisis des entiers, 0 pour terminer.")
  LIRE(valeur)

  TANT QUE valeur <> 0 FAIRE
    somme <- somme + valeur
    combien <- combien + 1
    LIRE(valeur)
  FINTANTQUE

  ECRIRE("Tu as saisi ", combien, " valeurs, de somme ", somme)
FIN
`,
    inputs: ["5", "10", "2", "0"],
  },
  {
    title: "REPETER … JUSQU'A",
    code: `ALGORITHME ControlerLaSaisie

VARIABLES
  note : REEL

DEBUT
  REPETER
    AFFICHER("Note entre 0 et 20 : ")
    LIRE(note)
    SI note < 0 OU note > 20 ALORS
      ECRIRE("Valeur invalide, recommence.")
    FINSI
  JUSQU'A note >= 0 ET note <= 20

  ECRIRE("Note enregistree : ", note)
FIN
`,
    inputs: ["25", "-3", "14"],
  },
  {
    title: "Le PAS : compter autrement",
    code: `ALGORITHME CompterAutrement

VARIABLES
  i : ENTIER

DEBUT
  AFFICHER("Les nombres pairs de 0 a 10 :")
  POUR i DE 0 A 10 PAS 2 FAIRE
    ECRIRE(i)
  FINPOUR

  AFFICHER("Compte a rebours :")
  POUR i DE 5 A 1 PAS -1 FAIRE
    ECRIRE(i)
  FINPOUR
  ECRIRE("Decollage")
FIN
`,
  },
  {
    title: "Boucles imbriquées",
    code: `ALGORITHME TriangleEtoiles

VARIABLES
  ligne, colonne : ENTIER
  motif : CHAINE

DEBUT
  POUR ligne DE 1 A 5 FAIRE
    motif <- ""
    POUR colonne DE 1 A ligne FAIRE
      motif <- motif + "*"
    FINPOUR
    ECRIRE(motif)
  FINPOUR
FIN
`,
  },
  {
    title: "Déclarer et remplir un tableau",
    code: `ALGORITHME RemplirUnTableau

VARIABLES
  t : TABLEAU[1..5] DE ENTIER
  i : ENTIER

DEBUT
  // Remplissage case par case
  t[1] <- 12
  t[2] <- 7
  t[3] <- 25

  // Remplissage par une boucle
  POUR i DE 4 A 5 FAIRE
    t[i] <- i * 100
  FINPOUR

  ECRIRE("Case 3 : ", t[3])
  ECRIRE("Case 5 : ", t[5])
FIN
`,
  },
  {
    title: "Parcourir un tableau",
    code: `ALGORITHME ParcourirEtCalculer

VARIABLES
  t : TABLEAU[1..6] DE ENTIER
  i, somme, pairs : ENTIER

DEBUT
  t[1] <- 4
  t[2] <- 9
  t[3] <- 2
  t[4] <- 7
  t[5] <- 6
  t[6] <- 1

  somme <- 0
  pairs <- 0

  POUR i DE 1 A 6 FAIRE
    somme <- somme + t[i]
    SI t[i] MOD 2 = 0 ALORS
      pairs <- pairs + 1
    FINSI
  FINPOUR

  ECRIRE("Somme : ", somme)
  ECRIRE("Nombre de valeurs paires : ", pairs)
  ECRIRE("Moyenne : ", somme / 6)
FIN
`,
  },
  {
    title: "Chercher le minimum et le maximum",
    code: `ALGORITHME MinimumEtMaximum

VARIABLES
  t : TABLEAU[1..6] DE ENTIER
  i, mini, maxi, positionMax : ENTIER

DEBUT
  t[1] <- 14
  t[2] <- 3
  t[3] <- 27
  t[4] <- 8
  t[5] <- 27
  t[6] <- 19

  mini <- t[1]
  maxi <- t[1]
  positionMax <- 1

  POUR i DE 2 A 6 FAIRE
    SI t[i] < mini ALORS
      mini <- t[i]
    FINSI
    SI t[i] > maxi ALORS
      maxi <- t[i]
      positionMax <- i
    FINSI
  FINPOUR

  ECRIRE("Minimum : ", mini)
  ECRIRE("Maximum : ", maxi, " en position ", positionMax)
FIN
`,
  },
  {
    title: "Rechercher une valeur",
    code: `ALGORITHME RechercherUneValeur

VARIABLES
  t : TABLEAU[1..6] DE ENTIER
  i, cherche, position : ENTIER
  trouve : BOOLEEN

DEBUT
  t[1] <- 5
  t[2] <- 12
  t[3] <- 8
  t[4] <- 30
  t[5] <- 12
  t[6] <- 1

  cherche <- 30
  trouve <- FAUX
  position <- 0
  i <- 1

  TANT QUE i <= 6 ET NON trouve FAIRE
    SI t[i] = cherche ALORS
      trouve <- VRAI
      position <- i
    FINSI
    i <- i + 1
  FINTANTQUE

  SI trouve ALORS
    ECRIRE(cherche, " trouve en position ", position)
  SINON
    ECRIRE(cherche, " absent du tableau")
  FINSI
FIN
`,
  },
  {
    title: "Le tri à bulles",
    code: `ALGORITHME TriParBulles

VARIABLES
  t : TABLEAU[1..6] DE ENTIER
  i, j, temporaire : ENTIER

DEBUT
  t[1] <- 5
  t[2] <- 2
  t[3] <- 9
  t[4] <- 1
  t[5] <- 7
  t[6] <- 3

  POUR i DE 1 A 5 FAIRE
    POUR j DE 1 A 6 - i FAIRE
      SI t[j] > t[j + 1] ALORS
        temporaire <- t[j]
        t[j] <- t[j + 1]
        t[j + 1] <- temporaire
      FINSI
    FINPOUR
  FINPOUR

  POUR i DE 1 A 6 FAIRE
    ECRIRE("t[", i, "] = ", t[i])
  FINPOUR
FIN
`,
  },
  {
    title: "Tableaux à deux dimensions",
    code: `ALGORITHME MatriceDeNotes

VARIABLES
  notes : TABLEAU[1..3, 1..4] DE ENTIER
  eleve, matiere, total : ENTIER

DEBUT
  // 3 eleves, 4 matieres
  POUR eleve DE 1 A 3 FAIRE
    POUR matiere DE 1 A 4 FAIRE
      notes[eleve, matiere] <- 8 + eleve + matiere
    FINPOUR
  FINPOUR

  POUR eleve DE 1 A 3 FAIRE
    total <- 0
    POUR matiere DE 1 A 4 FAIRE
      total <- total + notes[eleve, matiere]
    FINPOUR
    ECRIRE("Eleve ", eleve, " : moyenne ", total / 4)
  FINPOUR
FIN
`,
  },
  {
    title: "Les procédures",
    code: `ALGORITHME UtiliserUneProcedure

PROCEDURE AfficherLigne(symbole : CHAINE, longueur : ENTIER)
VARIABLES
  i : ENTIER
  resultat : CHAINE
DEBUT
  resultat <- ""
  POUR i DE 1 A longueur FAIRE
    resultat <- resultat + symbole
  FINPOUR
  ECRIRE(resultat)
FIN

DEBUT
  AfficherLigne("=", 25)
  ECRIRE("   BULLETIN DE NOTES")
  AfficherLigne("=", 25)
  ECRIRE("Mathematiques : 15")
  ECRIRE("Algorithmique : 17")
  AfficherLigne("-", 25)
FIN
`,
  },
  {
    title: "Les fonctions",
    code: `ALGORITHME UtiliserDesFonctions

FONCTION Carre(x : REEL) : REEL
DEBUT
  RETOURNER x * x
FIN

FONCTION EstPair(n : ENTIER) : BOOLEEN
DEBUT
  RETOURNER n MOD 2 = 0
FIN

FONCTION Maximum(a : ENTIER, b : ENTIER) : ENTIER
DEBUT
  SI a > b ALORS
    RETOURNER a
  SINON
    RETOURNER b
  FINSI
FIN

VARIABLES
  i : ENTIER

DEBUT
  ECRIRE("Carre de 7 : ", Carre(7))
  ECRIRE("Le plus grand entre 12 et 8 : ", Maximum(12, 8))

  POUR i DE 1 A 5 FAIRE
    SI EstPair(i) ALORS
      ECRIRE(i, " est pair")
    FINSI
  FINPOUR
FIN
`,
  },
  {
    title: "Passage par valeur ou par référence",
    code: `ALGORITHME ValeurOuReference

PROCEDURE DoublerCopie(x : ENTIER)
DEBUT
  x <- x * 2
  ECRIRE("  dans la procedure, x vaut ", x)
FIN

PROCEDURE DoublerVraiment(VAR x : ENTIER)
DEBUT
  x <- x * 2
  ECRIRE("  dans la procedure, x vaut ", x)
FIN

VARIABLES
  nombre : ENTIER

DEBUT
  nombre <- 21
  ECRIRE("Avant : ", nombre)
  DoublerCopie(nombre)
  ECRIRE("Apres passage par valeur : ", nombre)

  DoublerVraiment(nombre)
  ECRIRE("Apres passage par reference : ", nombre)
FIN
`,
  },
  {
    title: "La récursivité",
    code: `ALGORITHME Recursivite

FONCTION Factorielle(n : ENTIER) : ENTIER
DEBUT
  SI n <= 1 ALORS
    RETOURNER 1                        // cas d arret
  SINON
    RETOURNER n * Factorielle(n - 1)   // appel recursif
  FINSI
FIN

VARIABLES
  k : ENTIER

DEBUT
  POUR k DE 1 A 6 FAIRE
    ECRIRE(k, "! = ", Factorielle(k))
  FINPOUR
FIN
`,
  },
  {
    title: "Manipuler du texte",
    code: `ALGORITHME AnalyserUnMot

VARIABLES
  mot : CHAINE
  i, voyelles : ENTIER
  lettre : CHAINE

DEBUT
  mot <- "algorithmique"
  voyelles <- 0

  POUR i DE 1 A LONGUEUR(mot) FAIRE
    lettre <- CAR(mot, i)
    SI lettre = "a" OU lettre = "e" OU lettre = "i"
       OU lettre = "o" OU lettre = "u" ALORS
      voyelles <- voyelles + 1
    FINSI
  FINPOUR

  ECRIRE("Mot : ", mot)
  ECRIRE("Longueur : ", LONGUEUR(mot))
  ECRIRE("En majuscules : ", MAJUSCULE(mot))
  ECRIRE("Les 5 premieres lettres : ", SOUSCHAINE(mot, 1, 5))
  ECRIRE("Nombre de voyelles : ", voyelles)
FIN
`,
  },
  {
    title: "La variable non initialisée",
    faux: true,
    code: `ALGORITHME CompteurNonInitialise
// PROGRAMME VOLONTAIREMENT FAUX

VARIABLES
  i, somme : ENTIER

DEBUT
  POUR i DE 1 A 5 FAIRE
    somme <- somme + i
  FINPOUR
  ECRIRE("Somme = ", somme)
FIN
`,
  },
  {
    title: "Le FINSI oublié",
    faux: true,
    code: `ALGORITHME FinsiOublie
// PROGRAMME VOLONTAIREMENT FAUX

VARIABLES
  age : ENTIER

DEBUT
  age <- 15
  SI age >= 18 ALORS
    ECRIRE("Majeur")
  SINON
    SI age >= 13 ALORS
      ECRIRE("Adolescent")
    SINON
      ECRIRE("Enfant")
    FINSI
FIN
`,
  },
  {
    title: "La boucle infinie",
    faux: true,
    code: `ALGORITHME BoucleQuiNeSarretePas
// PROGRAMME VOLONTAIREMENT FAUX

VARIABLES
  i : ENTIER

DEBUT
  i <- 1
  TANT QUE i <= 10 FAIRE
    ECRIRE("Tour numero ", i)
  FINTANTQUE
  ECRIRE("On n arrive jamais ici")
FIN
`,
  },
  {
    title: "Le mauvais type",
    faux: true,
    code: `ALGORITHME MelangerLesTypes
// PROGRAMME VOLONTAIREMENT FAUX

VARIABLES
  age : ENTIER
  message : CHAINE

DEBUT
  age <- 20
  message <- "J ai " + age + " ans"
  ECRIRE(message)
FIN
`,
  },
  {
    title: "Le coût d'un algorithme",
    code: `ALGORITHME ComparerDeuxCouts

VARIABLES
  t : TABLEAU[1..20] DE ENTIER
  i, j, somme, paires : ENTIER

DEBUT
  POUR i DE 1 A 20 FAIRE
    t[i] <- i
  FINPOUR

  // --- Version 1 : une seule boucle -> O(n)
  somme <- 0
  POUR i DE 1 A 20 FAIRE
    somme <- somme + t[i]
  FINPOUR
  ECRIRE("Somme = ", somme)

  // --- Version 2 : deux boucles imbriquees -> O(n au carre)
  paires <- 0
  POUR i DE 1 A 20 FAIRE
    POUR j DE 1 A 20 FAIRE
      SI t[i] + t[j] = 21 ALORS
        paires <- paires + 1
      FINSI
    FINPOUR
  FINPOUR
  ECRIRE("Paires de somme 21 : ", paires)
FIN
`,
  },
  {
    title: "Une boucle qui ne s'arrête jamais",
    faux: true,
    code: `ALGORITHME BoucleQuiSeloigne
// PROGRAMME VOLONTAIREMENT FAUX

VARIABLES
  i : ENTIER

DEBUT
  i <- 1
  TANT QUE i <= 5 FAIRE
    ECRIRE("Tour numero ", i)
    i <- i - 1
  FINTANTQUE
  ECRIRE("On n arrive jamais ici")
FIN
`,
  },
  {
    title: "Le code piégé : deux erreurs à trouver",
    // S'exécute sans erreur : seule la logique est fausse.
    code: `ALGORITHME CodePiege
// Ce programme s execute, mais son resultat est FAUX. Deux erreurs.

VARIABLES
  t : TABLEAU[1..5] DE ENTIER
  i, audessus : ENTIER
  somme, moyenne : REEL

DEBUT
  t[1] <- 12
  t[2] <- 6
  t[3] <- 18
  t[4] <- 9
  t[5] <- 15

  somme <- 0
  audessus <- 0

  POUR i DE 1 A 4 FAIRE
    somme <- somme + t[i]
    SI t[i] > 10 ALORS
      audessus <- audessus + 1
    FINSI
  FINPOUR

  moyenne <- somme / 4

  ECRIRE("Moyenne : ", moyenne)
  ECRIRE("Valeurs superieures a 10 : ", audessus)
FIN
`,
  },
  {
    title: "R1 · Affichage et saisie",
    code: `ALGORITHME ReferenceAffichageEtSaisie

VARIABLES
  nom : CHAINE
  age : ENTIER
  taille : REEL
  present : BOOLEEN
  initiale : CARACTERE

DEBUT
  // --- ECRIRE : affiche puis va a la ligne
  ECRIRE("Une ligne complete")
  ECRIRE("Plusieurs ", "morceaux ", "colles")
  ECRIRE("Calcul dans un ECRIRE : ", 3 * 7)

  // --- AFFICHER : affiche et reste sur la ligne
  AFFICHER("a")
  AFFICHER("b")
  AFFICHER("c")
  ECRIRE("")

  // --- SAUTLIGNE : une ligne vide
  SAUTLIGNE

  // --- LIRE : un type par variable
  AFFICHER("Ton nom : ")
  LIRE(nom)
  AFFICHER("Ton age : ")
  LIRE(age)
  AFFICHER("Ta taille en metres : ")
  LIRE(taille)
  AFFICHER("Present ? (VRAI ou FAUX) : ")
  LIRE(present)
  AFFICHER("Ton initiale : ")
  LIRE(initiale)

  // --- LIRE peut prendre plusieurs variables
  ECRIRE("Recapitulatif")
  ECRIRE("  nom     : ", nom)
  ECRIRE("  age     : ", age)
  ECRIRE("  taille  : ", taille)
  ECRIRE("  present : ", present)
  ECRIRE("  initiale: ", initiale)
FIN
`,
    inputs: ["Amine", "19", "1.78", "VRAI", "A"],
  },
  {
    title: "R2 · Types, déclarations et affectations",
    code: `ALGORITHME ReferenceTypes

VARIABLES
  entierA, entierB : ENTIER
  reelA : REEL
  texteA : CHAINE
  lettreA : CARACTERE
  drapeau : BOOLEEN
  notes : TABLEAU[1..5] DE REEL
  grille : TABLEAU[1..2, 1..3] DE ENTIER
  indices : TABLEAU[0..4] DE ENTIER

VARIABLES
  i, j : ENTIER

DEBUT
  // --- affectations simples
  entierA <- 10
  entierB <- entierA          // copie de valeur
  reelA <- 3.5
  texteA <- "algorithmique"
  lettreA <- "A"
  drapeau <- VRAI

  // --- affectation avec calcul
  entierA <- entierA * 2 + 1

  // --- tableau : case par case
  notes[1] <- 12.5
  notes[2] <- 8

  // --- tableau : par une boucle
  POUR i DE 3 A 5 FAIRE
    notes[i] <- i * 2
  FINPOUR

  // --- tableau 2 dimensions
  POUR i DE 1 A 2 FAIRE
    POUR j DE 1 A 3 FAIRE
      grille[i, j] <- i * 10 + j
    FINPOUR
  FINPOUR

  // --- un tableau peut commencer a 0
  POUR i DE 0 A 4 FAIRE
    indices[i] <- i * i
  FINPOUR

  ECRIRE("entierA = ", entierA, "  reelA = ", reelA)
  ECRIRE("texteA = ", texteA, "  lettreA = ", lettreA,
         "  drapeau = ", drapeau)
  ECRIRE("notes[3] = ", notes[3], "  grille[2,3] = ", grille[2, 3])
  ECRIRE("indices[0] = ", indices[0], "  indices[4] = ", indices[4])
FIN
`,
  },
  {
    title: "R3 · Tous les opérateurs",
    code: `ALGORITHME ReferenceOperateurs

VARIABLES
  a, b : ENTIER
  x : REEL
  vrai1, vrai2 : BOOLEEN

DEBUT
  a <- 17
  b <- 5

  ECRIRE("--- Arithmetique ---")
  ECRIRE("a + b   = ", a + b)
  ECRIRE("a - b   = ", a - b)
  ECRIRE("a * b   = ", a * b)
  ECRIRE("a / b   = ", a / b, "   (division reelle)")
  ECRIRE("a DIV b = ", a DIV b, "   (quotient entier)")
  ECRIRE("a MOD b = ", a MOD b, "   (reste)")
  ECRIRE("a ^ 2   = ", a ^ 2)
  ECRIRE("-a      = ", -a)

  ECRIRE("--- Priorites ---")
  x <- 2 + 3 * 4
  ECRIRE("2 + 3 * 4     = ", x)
  x <- (2 + 3) * 4
  ECRIRE("(2 + 3) * 4   = ", x)
  x <- 2 ^ 3 ^ 2
  ECRIRE("2 ^ 3 ^ 2     = ", x)

  ECRIRE("--- Comparaisons ---")
  ECRIRE("a = b    : ", a = b)
  ECRIRE("a <> b   : ", a <> b)
  ECRIRE("a < b    : ", a < b)
  ECRIRE("a > b    : ", a > b)
  ECRIRE("a <= 17  : ", a <= 17)
  ECRIRE("a >= 18  : ", a >= 18)

  ECRIRE("--- Logique ---")
  vrai1 <- a > 10
  vrai2 <- b > 10
  ECRIRE("vrai1 ET vrai2 : ", vrai1 ET vrai2)
  ECRIRE("vrai1 OU vrai2 : ", vrai1 OU vrai2)
  ECRIRE("NON vrai2      : ", NON vrai2)

  ECRIRE("--- Texte ---")
  ECRIRE("Concatenation : ", "algo" + "rithme")
  ECRIRE("Comparaison   : ", "abc" < "abd")
FIN
`,
  },
  {
    title: "R4 · Toutes les structures conditionnelles",
    code: `ALGORITHME ReferenceConditions

VARIABLES
  n : ENTIER
  admis : BOOLEEN

DEBUT
  n <- 7
  admis <- VRAI

  // --- forme 1 : SI simple
  SI n > 0 ALORS
    ECRIRE("1. n est positif")
  FINSI

  // --- forme 2 : SI / SINON
  SI n MOD 2 = 0 ALORS
    ECRIRE("2. n est pair")
  SINON
    ECRIRE("2. n est impair")
  FINSI

  // --- forme 3 : SI imbriques (un FINSI par SI)
  SI n < 0 ALORS
    ECRIRE("3. negatif")
  SINON
    SI n = 0 ALORS
      ECRIRE("3. nul")
    SINON
      SI n < 10 ALORS
        ECRIRE("3. petit positif")
      SINON
        ECRIRE("3. grand positif")
      FINSI
    FINSI
  FINSI

  // --- forme 4 : conditions combinees
  SI n > 0 ET n < 10 ALORS
    ECRIRE("4. un seul chiffre")
  FINSI

  SI n < 0 OU n > 100 ALORS
    ECRIRE("4. hors plage")
  SINON
    ECRIRE("4. dans la plage 0..100")
  FINSI

  // --- booleen teste directement (sans = VRAI)
  SI admis ALORS
    ECRIRE("5. admis")
  FINSI
  SI NON admis ALORS
    ECRIRE("5. ajourne")
  FINSI

  // --- imbrication
  SI n > 0 ALORS
    SI n MOD 2 = 1 ALORS
      ECRIRE("6. positif ET impair")
    FINSI
  FINSI
FIN
`,
  },
  {
    title: "R5 · Toutes les boucles",
    code: `ALGORITHME ReferenceBoucles

VARIABLES
  i, j, n, somme : ENTIER

DEBUT
  ECRIRE("--- POUR croissant ---")
  POUR i DE 1 A 5 FAIRE
    AFFICHER(i)
    AFFICHER(" ")
  FINPOUR
  ECRIRE("")

  ECRIRE("--- POUR avec PAS ---")
  POUR i DE 0 A 10 PAS 2 FAIRE
    AFFICHER(i)
    AFFICHER(" ")
  FINPOUR
  ECRIRE("")

  ECRIRE("--- POUR decroissant ---")
  POUR i DE 5 A 1 PAS -1 FAIRE
    AFFICHER(i)
    AFFICHER(" ")
  FINPOUR
  ECRIRE("")

  ECRIRE("--- TANT QUE ---")
  n <- 1
  TANT QUE n <= 32 FAIRE
    AFFICHER(n)
    AFFICHER(" ")
    n <- n * 2
  FINTANTQUE
  ECRIRE("")

  ECRIRE("--- REPETER JUSQU A ---")
  n <- 0
  REPETER
    n <- n + 3
    AFFICHER(n)
    AFFICHER(" ")
  JUSQU'A n >= 12
  ECRIRE("")

  ECRIRE("--- Boucles imbriquees ---")
  POUR i DE 1 A 3 FAIRE
    POUR j DE 1 A 3 FAIRE
      AFFICHER(i * j)
      AFFICHER(" ")
    FINPOUR
    ECRIRE("")
  FINPOUR

  ECRIRE("--- Accumulateur ---")
  somme <- 0
  POUR i DE 1 A 100 FAIRE
    somme <- somme + i
  FINPOUR
  ECRIRE("Somme de 1 a 100 = ", somme)
FIN
`,
  },
  {
    title: "R6 · Tableaux : toutes les opérations",
    code: `ALGORITHME ReferenceTableaux

VARIABLES
  t : TABLEAU[1..8] DE ENTIER
  m : TABLEAU[1..3, 1..3] DE ENTIER
  i, j, somme, maxi, mini, position, cherche, temporaire : ENTIER
  trouve : BOOLEEN

DEBUT
  // --- 1. remplissage
  t[1] <- 9
  t[2] <- 3
  t[3] <- 7
  t[4] <- 1
  t[5] <- 8
  t[6] <- 3
  t[7] <- 5
  t[8] <- 2

  // --- 2. affichage
  AFFICHER("Tableau : ")
  POUR i DE 1 A 8 FAIRE
    AFFICHER(t[i])
    AFFICHER(" ")
  FINPOUR
  ECRIRE("")

  // --- 3. somme et moyenne
  somme <- 0
  POUR i DE 1 A 8 FAIRE
    somme <- somme + t[i]
  FINPOUR
  ECRIRE("Somme = ", somme, "   Moyenne = ", somme / 8)

  // --- 4. minimum et maximum
  mini <- t[1]
  maxi <- t[1]
  POUR i DE 2 A 8 FAIRE
    SI t[i] < mini ALORS
      mini <- t[i]
    FINSI
    SI t[i] > maxi ALORS
      maxi <- t[i]
    FINSI
  FINPOUR
  ECRIRE("Minimum = ", mini, "   Maximum = ", maxi)

  // --- 5. recherche sequentielle avec arret anticipe
  cherche <- 8
  trouve <- FAUX
  position <- 0
  i <- 1
  TANT QUE i <= 8 ET NON trouve FAIRE
    SI t[i] = cherche ALORS
      trouve <- VRAI
      position <- i
    FINSI
    i <- i + 1
  FINTANTQUE
  SI trouve ALORS
    ECRIRE(cherche, " trouve en position ", position)
  SINON
    ECRIRE(cherche, " absent")
  FINSI

  // --- 6. comptage sous condition
  somme <- 0
  POUR i DE 1 A 8 FAIRE
    SI t[i] MOD 2 = 1 ALORS
      somme <- somme + 1
    FINSI
  FINPOUR
  ECRIRE("Valeurs impaires : ", somme)

  // --- 7. tri par bulles
  POUR i DE 1 A 7 FAIRE
    POUR j DE 1 A 8 - i FAIRE
      SI t[j] > t[j + 1] ALORS
        temporaire <- t[j]
        t[j] <- t[j + 1]
        t[j + 1] <- temporaire
      FINSI
    FINPOUR
  FINPOUR
  AFFICHER("Trie   : ")
  POUR i DE 1 A 8 FAIRE
    AFFICHER(t[i])
    AFFICHER(" ")
  FINPOUR
  ECRIRE("")

  // --- 8. tableau a deux dimensions
  POUR i DE 1 A 3 FAIRE
    POUR j DE 1 A 3 FAIRE
      m[i, j] <- i * j
    FINPOUR
  FINPOUR
  ECRIRE("Table de multiplication 3x3 :")
  POUR i DE 1 A 3 FAIRE
    POUR j DE 1 A 3 FAIRE
      AFFICHER(m[i, j])
      AFFICHER("  ")
    FINPOUR
    ECRIRE("")
  FINPOUR
FIN
`,
  },
  {
    title: "R7 · Sous-programmes : toutes les formes",
    code: `ALGORITHME ReferenceSousProgrammes

// --- procedure sans parametre
PROCEDURE Separateur
DEBUT
  ECRIRE("--------------------")
FIN

// --- procedure avec parametres (passage par valeur)
PROCEDURE Saluer(nom : CHAINE, fois : ENTIER)
VARIABLES
  i : ENTIER
DEBUT
  POUR i DE 1 A fois FAIRE
    ECRIRE("Bonjour ", nom)
  FINPOUR
FIN

// --- procedure avec passage par reference
PROCEDURE Echanger(VAR a : ENTIER, VAR b : ENTIER)
VARIABLES
  temporaire : ENTIER
DEBUT
  temporaire <- a
  a <- b
  b <- temporaire
FIN

// --- fonction avec RETOURNER
FONCTION Maximum(a : ENTIER, b : ENTIER) : ENTIER
DEBUT
  SI a > b ALORS
    RETOURNER a
  SINON
    RETOURNER b
  FINSI
FIN

// --- fonction qui renvoie un booleen
FONCTION EstPremier(n : ENTIER) : BOOLEEN
VARIABLES
  d : ENTIER
DEBUT
  SI n < 2 ALORS
    RETOURNER FAUX
  FINSI
  d <- 2
  TANT QUE d * d <= n FAIRE
    SI n MOD d = 0 ALORS
      RETOURNER FAUX
    FINSI
    d <- d + 1
  FINTANTQUE
  RETOURNER VRAI
FIN

// --- fonction recursive
FONCTION Puissance(base : ENTIER, exposant : ENTIER) : ENTIER
DEBUT
  SI exposant = 0 ALORS
    RETOURNER 1
  SINON
    RETOURNER base * Puissance(base, exposant - 1)
  FINSI
FIN

VARIABLES
  x, y, k : ENTIER

DEBUT
  Separateur
  Saluer("Sara", 2)
  Separateur

  x <- 4
  y <- 9
  ECRIRE("Avant echange : x = ", x, "  y = ", y)
  Echanger(x, y)
  ECRIRE("Apres echange : x = ", x, "  y = ", y)

  ECRIRE("Maximum(4, 9) = ", Maximum(4, 9))
  ECRIRE("2 puissance 10 = ", Puissance(2, 10))

  AFFICHER("Nombres premiers jusqu a 30 : ")
  POUR k DE 2 A 30 FAIRE
    SI EstPremier(k) ALORS
      AFFICHER(k)
      AFFICHER(" ")
    FINSI
  FINPOUR
  ECRIRE("")
FIN
`,
  },
  {
    title: "R8 · Toutes les fonctions prédéfinies",
    code: `ALGORITHME ReferenceFonctions

VARIABLES
  mot : CHAINE
  i : ENTIER

DEBUT
  ECRIRE("--- Nombres ---")
  ECRIRE("RACINE(144)    = ", RACINE(144))
  ECRIRE("ABS(-12)       = ", ABS(-12))
  ECRIRE("ENT(7.9)       = ", ENT(7.9), "   (partie entiere)")
  ECRIRE("ARRONDI(7.9)   = ", ARRONDI(7.9))
  ECRIRE("ARRONDI(7.2)   = ", ARRONDI(7.2))

  ECRIRE("--- Conversions ---")
  ECRIRE("ENTIER du texte 42    = ", ENTIER("42"))
  ECRIRE("REEL du texte 3.5     = ", REEL("3.5"))
  ECRIRE("CHAINE du nombre 2026 = ", "annee " + CHAINE(2026))

  ECRIRE("--- Texte ---")
  mot <- "Algorithmique"
  ECRIRE("LONGUEUR       = ", LONGUEUR(mot))
  ECRIRE("MAJUSCULE      = ", MAJUSCULE(mot))
  ECRIRE("MINUSCULE      = ", MINUSCULE(mot))
  ECRIRE("SOUSCHAINE 1,4 = ", SOUSCHAINE(mot, 1, 4))
  ECRIRE("SOUSCHAINE 5,9 = ", SOUSCHAINE(mot, 5, 9))
  ECRIRE("CAR(mot, 1)    = ", CAR(mot, 1))
  ECRIRE("CAR(mot, 3)    = ", CAR(mot, 3))

  AFFICHER("Lettre par lettre : ")
  POUR i DE 1 A LONGUEUR(mot) FAIRE
    AFFICHER(CAR(mot, i))
    AFFICHER(".")
  FINPOUR
  ECRIRE("")

  ECRIRE("--- Codes des caracteres ---")
  ECRIRE("ASCII de A     = ", ASCII("A"))
  ECRIRE("CARACTERE(66)  = ", CARACTERE(66))

  ECRIRE("--- Hasard ---")
  AFFICHER("Cinq des : ")
  POUR i DE 1 A 5 FAIRE
    AFFICHER(ALEA(1, 6))
    AFFICHER(" ")
  FINPOUR
  ECRIRE("")
FIN
`,
  },
  {
    title: "R9 · Modèle complet à réutiliser",
    code: `ALGORITHME GestionDesNotes
// Modele complet : saisie controlee, traitement, resultats

FONCTION LireNoteValide(numero : ENTIER) : REEL
VARIABLES
  note : REEL
DEBUT
  REPETER
    AFFICHER("Note ")
    AFFICHER(numero)
    AFFICHER(" (0 a 20) : ")
    LIRE(note)
    SI note < 0 OU note > 20 ALORS
      ECRIRE("  Valeur invalide, recommence.")
    FINSI
  JUSQU'A note >= 0 ET note <= 20
  RETOURNER note
FIN

FONCTION Mention(moyenne : REEL) : CHAINE
DEBUT
  SI moyenne < 10 ALORS
    RETOURNER "Ajourne"
  SINON
    SI moyenne < 12 ALORS
      RETOURNER "Passable"
    SINON
      SI moyenne < 14 ALORS
        RETOURNER "Assez bien"
      SINON
        SI moyenne < 16 ALORS
          RETOURNER "Bien"
        SINON
          RETOURNER "Tres bien"
        FINSI
      FINSI
    FINSI
  FINSI
FIN

PROCEDURE Titre(texte : CHAINE)
DEBUT
  ECRIRE("========================")
  ECRIRE(texte)
  ECRIRE("========================")
FIN

VARIABLES
  notes : TABLEAU[1..4] DE REEL
  i, admises : ENTIER
  somme, moyenne, maxi : REEL

DEBUT
  Titre("SAISIE DES NOTES")

  somme <- 0
  admises <- 0

  POUR i DE 1 A 4 FAIRE
    notes[i] <- LireNoteValide(i)
    somme <- somme + notes[i]
    SI notes[i] >= 10 ALORS
      admises <- admises + 1
    FINSI
  FINPOUR

  moyenne <- somme / 4

  maxi <- notes[1]
  POUR i DE 2 A 4 FAIRE
    SI notes[i] > maxi ALORS
      maxi <- notes[i]
    FINSI
  FINPOUR

  Titre("RESULTATS")
  ECRIRE("Moyenne          : ", moyenne)
  ECRIRE("Meilleure note   : ", maxi)
  ECRIRE("Notes >= 10      : ", admises, " sur 4")
  ECRIRE("Mention          : ", Mention(moyenne))
FIN
`,
    inputs: ["25", "12", "8", "15", "17"],
  },
];
