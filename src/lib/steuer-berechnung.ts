/**
 * Steuer-Berechnung für eine Buchhaltung.
 * Annahme: `betrag` einer Buchung ist immer der BRUTTOBETRAG.
 *   netto = brutto / (1 + mwst_satz/100)
 *   mwst  = brutto - netto
 */

export interface BuchungInput {
  betrag: number;
  mwst_satz: number;
  kategorie: string; // "Einnahme" | "Ausgabe"
}

export interface SatzGruppe {
  satz: number;
  brutto: number;
  netto: number;
  mwst: number;
  count: number;
}

export interface SteuerUebersicht {
  einnahmen: {
    gruppen: SatzGruppe[]; // sortiert: 19, 7, 0
    bruttoGesamt: number;
    nettoGesamt: number;
    umsatzsteuerGesamt: number;
  };
  ausgaben: {
    gruppen: SatzGruppe[];
    bruttoGesamt: number;
    nettoGesamt: number;
    vorsteuerGesamt: number;
  };
  zahllast: number; // > 0 = zu zahlen, < 0 = Erstattung
  buchungenAnzahl: number;
}

const SAETZE = [19, 7, 0];

function leereGruppen(): SatzGruppe[] {
  return SAETZE.map((satz) => ({ satz, brutto: 0, netto: 0, mwst: 0, count: 0 }));
}

function aggregiere(buchungen: BuchungInput[]): { gruppen: SatzGruppe[]; brutto: number; netto: number; mwst: number } {
  const gruppen = leereGruppen();
  for (const b of buchungen) {
    const brutto = Number(b.betrag) || 0;
    const satz = Number(b.mwst_satz) || 0;
    const netto = satz === 0 ? brutto : brutto / (1 + satz / 100);
    const mwst = brutto - netto;

    // Passende Satz-Gruppe finden, sonst erste 0%-Gruppe nehmen
    let g = gruppen.find((x) => x.satz === satz);
    if (!g) {
      g = { satz, brutto: 0, netto: 0, mwst: 0, count: 0 };
      gruppen.push(g);
    }
    g.brutto += brutto;
    g.netto += netto;
    g.mwst += mwst;
    g.count += 1;
  }
  // Sortieren: höchster Satz zuerst
  gruppen.sort((a, b) => b.satz - a.satz);
  const brutto = gruppen.reduce((s, g) => s + g.brutto, 0);
  const netto = gruppen.reduce((s, g) => s + g.netto, 0);
  const mwst = gruppen.reduce((s, g) => s + g.mwst, 0);
  return { gruppen, brutto, netto, mwst };
}

export function berechneSteuer(buchungen: BuchungInput[]): SteuerUebersicht {
  const einnahmenBuchungen = buchungen.filter((b) => b.kategorie === "Einnahme");
  const ausgabenBuchungen = buchungen.filter((b) => b.kategorie === "Ausgabe");

  const einnahmenAgg = aggregiere(einnahmenBuchungen);
  const ausgabenAgg = aggregiere(ausgabenBuchungen);

  return {
    einnahmen: {
      gruppen: einnahmenAgg.gruppen,
      bruttoGesamt: einnahmenAgg.brutto,
      nettoGesamt: einnahmenAgg.netto,
      umsatzsteuerGesamt: einnahmenAgg.mwst,
    },
    ausgaben: {
      gruppen: ausgabenAgg.gruppen,
      bruttoGesamt: ausgabenAgg.brutto,
      nettoGesamt: ausgabenAgg.netto,
      vorsteuerGesamt: ausgabenAgg.mwst,
    },
    zahllast: einnahmenAgg.mwst - ausgabenAgg.mwst,
    buchungenAnzahl: buchungen.length,
  };
}

export function formatEuro(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
