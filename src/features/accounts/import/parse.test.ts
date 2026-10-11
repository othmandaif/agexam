import { describe, expect, it } from "vitest";
import { MAX_IMPORT_ROWS, parseCsv, parseStudentSheet } from "./parse";

describe("parseStudentSheet", () => {
  it("lit les colonnes du modèle, quel que soit l'ordre ou la casse", () => {
    const result = parseStudentSheet([
      ["GROUPE", "E-mail", "Nom complet"],
      ["dev101", " Salma.Benali@Etab.ma ", "  Salma   Benali "],
    ]);
    expect(result.fatal).toBeUndefined();
    expect(result.rows).toEqual([
      {
        line: 2,
        fullName: "Salma Benali",
        email: "salma.benali@etab.ma",
        groupName: "DEV101",
        errors: [],
      },
    ]);
  });

  it("combine Prénom + Nom quand il n'y a pas de nom complet", () => {
    const { rows } = parseStudentSheet([
      ["Nom", "Prénom", "Email"],
      ["El Amrani", "Yassine", "y.elamrani@etab.ma"],
    ]);
    expect(rows[0]!.fullName).toBe("Yassine El Amrani");
    expect(rows[0]!.groupName).toBeNull();
  });

  it("ignore les lignes vides et signale les erreurs ligne par ligne", () => {
    const { rows } = parseStudentSheet([
      [],
      ["Nom complet", "E-mail"],
      ["Omar Idrissi", "omar@etab.ma"],
      ["", ""],
      ["X", "pas-un-email"],
      ["Omar Bis", "OMAR@etab.ma"],
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[0]!.errors).toEqual([]);
    expect(rows[1]!.line).toBe(5);
    expect(rows[1]!.errors).toEqual(["Nom manquant.", "E-mail invalide."]);
    expect(rows[2]!.errors).toEqual(["E-mail en double (déjà ligne 3)."]);
  });

  it("refuse un fichier sans les colonnes attendues", () => {
    expect(
      parseStudentSheet([
        ["Prénom", "Téléphone"],
        ["a", "b"],
      ]).fatal,
    ).toMatch(/Colonnes/);
    expect(parseStudentSheet([]).fatal).toMatch(/vide/);
  });

  it("refuse au-delà de la limite de lignes", () => {
    const table = [["Nom complet", "E-mail"]];
    for (let i = 0; i <= MAX_IMPORT_ROWS; i++) table.push([`Etudiant ${i}`, `e${i}@etab.ma`]);
    expect(parseStudentSheet(table).fatal).toMatch(/Trop de lignes/);
  });
});

describe("parseCsv", () => {
  it("détecte le point-virgule d'Excel en français et retire le BOM", () => {
    expect(parseCsv("﻿Nom complet;E-mail\r\nSalma Benali;s@etab.ma\r\n")).toEqual([
      ["Nom complet", "E-mail"],
      ["Salma Benali", "s@etab.ma"],
    ]);
  });

  it("gère les guillemets et les virgules dans un champ", () => {
    expect(parseCsv('nom,email\n"Benali, Salma","s@etab.ma"\n"Il dit ""bonjour""",x')).toEqual([
      ["nom", "email"],
      ["Benali, Salma", "s@etab.ma"],
      ['Il dit "bonjour"', "x"],
    ]);
  });
});
