// Erstellt aus Buchungen die Bestandteile einer echten Buchhaltung:
// Journal, Summen-Salden-Liste (SuSa) und Umsatzsteuer-Voranmeldung (UStVA).
// Pure Funktionen — leicht testbar, keine Side-Effects.

export interface BuchungInput {
  id: string;
  buchungsdatum: string;
  lieferant: string | null;
  konto: string;
  kategorie: string; // "Einnahme" | "Ausgabe"
  betrag: number; // Brutto
  beschreibung: string;
  mwst_satz: number;
  dokument_id: string | null;
}

export interface JournalZeile {
  nr: number;
  datum: string;
  beleg: string; // Beleg-Nummer / Lieferant
  konto: string;
  gegenkonto: string; // Bank (Standard)
  beschreibung: string;
  netto: number;
  mwst: number;
  brutto: number;
  mwst_satz: number;
  soll_haben: "S" | "H"; // S=Aufwand/Forderung, H=Erlös
  dokument_id: string | null;
}

export interface KontoSaldo {
  konto: string;
  kategorie: "Einnahme" | "Ausgabe";
  netto: number;
  mwst: number;
  brutto: number;
  buchungen_anzahl: number;
}

export interface SuSa {
  konten: KontoSaldo[];
  summe_einnahmen_netto: number;
  summe_ausgaben_netto: number;
  summe_vorsteuer: number;
  summe_umsatzsteuer: number;
  ergebnis: number; // Einnahmen - Ausgaben (EÜR)
}

// Amtliche ELSTER-Kennziffern für die UStVA
export interface UStVAKennziffern {
  // Steuerbare Umsätze
  "81": number; // Lieferungen 19% (Bemessungsgrundlage netto)
  "81_steuer": number; // USt 19%
  "86": number; // Lieferungen 7%
  "86_steuer": number; // USt 7%
  "35": number; // Umsätze 0% / steuerfrei
  // Vorsteuer
  "66": number; // Vorsteuer aus Rechnungen
  // Ergebnis
  "83": number; // Verbleibende USt-Vorauszahlung / Erstattung
}

function nettoAusBrutto(brutto: number, satz: number) {
  if (satz === 0) return { netto: brutto, mwst: 0 };
  const netto = brutto / (1 + satz / 100);
  const mwst = brutto - netto;
  return { netto, mwst };
}

export function erstelleJournal(buchungen: BuchungInput[]): JournalZeile[] {
  const sorted = [...buchungen].sort((a, b) =>
    a.buchungsdatum.localeCompare(b.buchungsdatum)
  );

  return sorted.map((b, idx) => {
    const { netto, mwst } = nettoAusBrutto(Number(b.betrag), Number(b.mwst_satz));
    const isEinnahme = b.kategorie === "Einnahme";
    return {
      nr: idx + 1,
      datum: b.buchungsdatum,
      beleg: b.lieferant ?? "—",
      konto: b.konto,
      gegenkonto: "Bank",
      beschreibung: b.beschreibung || b.lieferant || "",
      netto: Math.round(netto * 100) / 100,
      mwst: Math.round(mwst * 100) / 100,
      brutto: Math.round(Number(b.betrag) * 100) / 100,
      mwst_satz: Number(b.mwst_satz),
      soll_haben: isEinnahme ? "H" : "S",
      dokument_id: b.dokument_id,
    };
  });
}

export function erstelleSuSa(buchungen: BuchungInput[]): SuSa {
  const map = new Map<string, KontoSaldo>();

  for (const b of buchungen) {
    const kat = (b.kategorie === "Einnahme" ? "Einnahme" : "Ausgabe") as "Einnahme" | "Ausgabe";
    const key = `${kat}::${b.konto}`;
    const { netto, mwst } = nettoAusBrutto(Number(b.betrag), Number(b.mwst_satz));
    const existing = map.get(key);
    if (existing) {
      existing.netto += netto;
      existing.mwst += mwst;
      existing.brutto += Number(b.betrag);
      existing.buchungen_anzahl += 1;
    } else {
      map.set(key, {
        konto: b.konto,
        kategorie: kat,
        netto,
        mwst,
        brutto: Number(b.betrag),
        buchungen_anzahl: 1,
      });
    }
  }

  const konten = Array.from(map.values()).map((k) => ({
    ...k,
    netto: Math.round(k.netto * 100) / 100,
    mwst: Math.round(k.mwst * 100) / 100,
    brutto: Math.round(k.brutto * 100) / 100,
  }));

  konten.sort((a, b) => {
    if (a.kategorie !== b.kategorie) return a.kategorie === "Einnahme" ? -1 : 1;
    return b.brutto - a.brutto;
  });

  const summe_einnahmen_netto = konten
    .filter((k) => k.kategorie === "Einnahme")
    .reduce((s, k) => s + k.netto, 0);
  const summe_ausgaben_netto = konten
    .filter((k) => k.kategorie === "Ausgabe")
    .reduce((s, k) => s + k.netto, 0);
  const summe_umsatzsteuer = konten
    .filter((k) => k.kategorie === "Einnahme")
    .reduce((s, k) => s + k.mwst, 0);
  const summe_vorsteuer = konten
    .filter((k) => k.kategorie === "Ausgabe")
    .reduce((s, k) => s + k.mwst, 0);

  return {
    konten,
    summe_einnahmen_netto: Math.round(summe_einnahmen_netto * 100) / 100,
    summe_ausgaben_netto: Math.round(summe_ausgaben_netto * 100) / 100,
    summe_vorsteuer: Math.round(summe_vorsteuer * 100) / 100,
    summe_umsatzsteuer: Math.round(summe_umsatzsteuer * 100) / 100,
    ergebnis: Math.round((summe_einnahmen_netto - summe_ausgaben_netto) * 100) / 100,
  };
}

export function erstelleUStVA(buchungen: BuchungInput[]): UStVAKennziffern {
  const result: UStVAKennziffern = {
    "81": 0,
    "81_steuer": 0,
    "86": 0,
    "86_steuer": 0,
    "35": 0,
    "66": 0,
    "83": 0,
  };

  for (const b of buchungen) {
    const satz = Number(b.mwst_satz);
    const { netto, mwst } = nettoAusBrutto(Number(b.betrag), satz);
    if (b.kategorie === "Einnahme") {
      if (satz === 19) {
        result["81"] += netto;
        result["81_steuer"] += mwst;
      } else if (satz === 7) {
        result["86"] += netto;
        result["86_steuer"] += mwst;
      } else {
        result["35"] += netto;
      }
    } else {
      result["66"] += mwst;
    }
  }

  // Runden
  for (const k of Object.keys(result) as (keyof UStVAKennziffern)[]) {
    result[k] = Math.round(result[k] * 100) / 100;
  }

  result["83"] =
    Math.round(
      (result["81_steuer"] + result["86_steuer"] - result["66"]) * 100
    ) / 100;

  return result;
}

export function elsterCsvExport(kz: UStVAKennziffern, monat: string, mandant: string): string {
  // CSV-Format für manuellen ELSTER-Upload — Kennziffer;Wert
  const v = (k: keyof UStVAKennziffern) => Number(kz?.[k] ?? 0).toFixed(2);
  const rows = [
    ["Mandant", mandant],
    ["Voranmeldungszeitraum", monat],
    ["", ""],
    ["Kennziffer", "Bemessungsgrundlage / Betrag (EUR)"],
    ["81 (Lieferungen 19%)", v("81")],
    ["86 (Lieferungen 7%)", v("86")],
    ["35 (Steuerfreie Umsätze)", v("35")],
    ["66 (Vorsteuerbeträge)", v("66")],
    ["83 (Zahllast / Erstattung)", v("83")],
  ];
  return rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
}
