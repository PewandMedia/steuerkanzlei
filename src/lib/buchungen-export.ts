// CSV-Export-Helper für Buchungen einer Buchhaltung

interface BuchungExport {
  buchungsdatum: string;
  lieferant: string | null;
  beschreibung: string;
  konto: string;
  kategorie: string;
  mwst_satz: number;
  betrag: number;
}

const escapeCsv = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const formatEuroPlain = (n: number) =>
  n.toFixed(2).replace(".", ",");

export function exportBuchungenAsCsv(
  buchungen: BuchungExport[],
  mandantName: string,
  monat: string,
) {
  const header = [
    "Datum",
    "Lieferant/Kunde",
    "Beschreibung",
    "Konto",
    "Kategorie",
    "MwSt %",
    "Brutto",
    "Netto",
    "MwSt-Betrag",
  ];

  const rows = buchungen.map((b) => {
    const brutto = Number(b.betrag);
    const mwst = Number(b.mwst_satz);
    const netto = mwst > 0 ? brutto / (1 + mwst / 100) : brutto;
    const mwstBetrag = brutto - netto;
    return [
      new Date(b.buchungsdatum).toLocaleDateString("de-DE"),
      b.lieferant ?? "",
      b.beschreibung ?? "",
      b.konto,
      b.kategorie,
      mwst.toString(),
      formatEuroPlain(brutto),
      formatEuroPlain(netto),
      formatEuroPlain(mwstBetrag),
    ].map(escapeCsv).join(";");
  });

  const csv = "\uFEFF" + [header.join(";"), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeMandant = mandantName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeMonat = monat.replace(/[^a-zA-Z0-9_-]/g, "_");
  a.download = `Buchungen_${safeMandant}_${safeMonat}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
