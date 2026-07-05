// Edge Function: Schließt eine Buchhaltung ab.
// - Lädt alle Buchungen + Mandant + Buchhaltung
// - Berechnet Journal, SuSa, UStVA
// - Generiert PDFs (Journal, SuSa, UStVA, Beleg-Verzeichnis) mit pdf-lib
// - Lädt PDFs in Storage-Bucket "buchhaltungen" hoch
// - Speichert Snapshot in Tabelle "buchhaltungs_abschluesse"
// - Setzt Status der Buchhaltung auf "In Prüfung"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BuchungRow {
  id: string;
  buchungsdatum: string;
  lieferant: string | null;
  konto: string;
  kategorie: string;
  betrag: number;
  beschreibung: string;
  mwst_satz: number;
  dokument_id: string | null;
}

function nettoAusBrutto(brutto: number, satz: number) {
  if (satz === 0) return { netto: brutto, mwst: 0 };
  const netto = brutto / (1 + satz / 100);
  return { netto, mwst: brutto - netto };
}

function fmtEur(n: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n) + " EUR";
}

function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleDateString("de-DE");
  } catch {
    return s;
  }
}

interface PdfCtx {
  doc: PDFDocument;
  font: any;
  bold: any;
  page: any;
  y: number;
  pageWidth: number;
  pageHeight: number;
  margin: number;
}

async function newPdf(): Promise<PdfCtx> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595, 842]); // A4
  return {
    doc,
    font,
    bold,
    page,
    y: 800,
    pageWidth: 595,
    pageHeight: 842,
    margin: 40,
  };
}

function ensureSpace(ctx: PdfCtx, needed: number) {
  if (ctx.y - needed < ctx.margin) {
    ctx.page = ctx.doc.addPage([ctx.pageWidth, ctx.pageHeight]);
    ctx.y = ctx.pageHeight - ctx.margin;
  }
}

function drawText(
  ctx: PdfCtx,
  text: string,
  x: number,
  options: { size?: number; bold?: boolean; color?: any } = {},
) {
  const size = options.size ?? 10;
  ctx.page.drawText(text, {
    x,
    y: ctx.y,
    size,
    font: options.bold ? ctx.bold : ctx.font,
    color: options.color ?? rgb(0, 0, 0),
  });
}

function drawLine(ctx: PdfCtx, y: number) {
  ctx.page.drawLine({
    start: { x: ctx.margin, y },
    end: { x: ctx.pageWidth - ctx.margin, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
}

function drawHeader(ctx: PdfCtx, title: string, mandant: string, monat: string) {
  drawText(ctx, title, ctx.margin, { size: 16, bold: true });
  ctx.y -= 22;
  drawText(ctx, `Mandant: ${mandant}`, ctx.margin, { size: 10 });
  ctx.y -= 14;
  drawText(ctx, `Voranmeldungszeitraum: ${monat}`, ctx.margin, { size: 10 });
  ctx.y -= 14;
  drawText(ctx, `Erstellt am: ${new Date().toLocaleDateString("de-DE")}`, ctx.margin, {
    size: 9,
    color: rgb(0.4, 0.4, 0.4),
  });
  ctx.y -= 18;
  drawLine(ctx, ctx.y);
  ctx.y -= 16;
}

async function buildJournalPdf(buchungen: BuchungRow[], mandant: string, monat: string): Promise<Uint8Array> {
  const ctx = await newPdf();
  drawHeader(ctx, "Buchungsjournal", mandant, monat);

  // Tabellen-Header
  const cols = [
    { x: 40, label: "Nr." },
    { x: 70, label: "Datum" },
    { x: 120, label: "Beleg" },
    { x: 220, label: "Konto" },
    { x: 340, label: "Netto" },
    { x: 400, label: "MwSt" },
    { x: 460, label: "Brutto" },
    { x: 540, label: "S/H" },
  ];
  for (const c of cols) drawText(ctx, c.label, c.x, { size: 9, bold: true });
  ctx.y -= 12;
  drawLine(ctx, ctx.y);
  ctx.y -= 12;

  const sorted = [...buchungen].sort((a, b) => a.buchungsdatum.localeCompare(b.buchungsdatum));
  let nr = 1;
  for (const b of sorted) {
    ensureSpace(ctx, 14);
    const { netto, mwst } = nettoAusBrutto(Number(b.betrag), Number(b.mwst_satz));
    const isEin = b.kategorie === "Einnahme";
    drawText(ctx, String(nr), 40, { size: 9 });
    drawText(ctx, fmtDate(b.buchungsdatum), 70, { size: 9 });
    drawText(ctx, (b.lieferant ?? "—").slice(0, 18), 120, { size: 9 });
    drawText(ctx, b.konto.slice(0, 22), 220, { size: 9 });
    drawText(ctx, fmtEur(netto), 340, { size: 9 });
    drawText(ctx, fmtEur(mwst), 400, { size: 9 });
    drawText(ctx, fmtEur(Number(b.betrag)), 460, { size: 9 });
    drawText(ctx, isEin ? "H" : "S", 540, { size: 9, bold: true });
    ctx.y -= 13;
    nr++;
  }

  ctx.y -= 6;
  drawLine(ctx, ctx.y);
  ctx.y -= 14;
  drawText(ctx, `Anzahl Buchungen: ${buchungen.length}`, 40, { size: 10, bold: true });

  return await ctx.doc.save();
}

async function buildSuSaPdf(
  konten: { konto: string; kategorie: string; netto: number; mwst: number; brutto: number; buchungen_anzahl: number }[],
  totals: { einnahmen: number; ausgaben: number; vorsteuer: number; ust: number; ergebnis: number },
  mandant: string,
  monat: string,
): Promise<Uint8Array> {
  const ctx = await newPdf();
  drawHeader(ctx, "Summen- und Saldenliste (SuSa)", mandant, monat);

  const sections: Array<["Einnahme" | "Ausgabe", string]> = [
    ["Einnahme", "ERLÖSE"],
    ["Ausgabe", "AUFWAND"],
  ];
  for (const [kat, label] of sections) {
    ensureSpace(ctx, 30);
    drawText(ctx, label, 40, { size: 11, bold: true });
    ctx.y -= 14;
    drawText(ctx, "Konto", 40, { size: 9, bold: true });
    drawText(ctx, "Anz.", 280, { size: 9, bold: true });
    drawText(ctx, "Netto", 340, { size: 9, bold: true });
    drawText(ctx, kat === "Einnahme" ? "USt" : "VSt", 410, { size: 9, bold: true });
    drawText(ctx, "Brutto", 480, { size: 9, bold: true });
    ctx.y -= 10;
    drawLine(ctx, ctx.y);
    ctx.y -= 12;

    const filtered = konten.filter((k) => k.kategorie === kat);
    if (filtered.length === 0) {
      drawText(ctx, "—", 40, { size: 9, color: rgb(0.5, 0.5, 0.5) });
      ctx.y -= 14;
    } else {
      for (const k of filtered) {
        ensureSpace(ctx, 14);
        drawText(ctx, k.konto.slice(0, 36), 40, { size: 9 });
        drawText(ctx, String(k.buchungen_anzahl), 280, { size: 9 });
        drawText(ctx, fmtEur(k.netto), 340, { size: 9 });
        drawText(ctx, fmtEur(k.mwst), 410, { size: 9 });
        drawText(ctx, fmtEur(k.brutto), 480, { size: 9 });
        ctx.y -= 13;
      }
    }
    ctx.y -= 8;
  }

  ensureSpace(ctx, 80);
  drawLine(ctx, ctx.y);
  ctx.y -= 16;
  drawText(ctx, "ZUSAMMENFASSUNG", 40, { size: 11, bold: true });
  ctx.y -= 16;
  drawText(ctx, `Summe Einnahmen (netto):`, 40, { size: 10 });
  drawText(ctx, fmtEur(totals.einnahmen), 320, { size: 10 });
  ctx.y -= 14;
  drawText(ctx, `Summe Ausgaben (netto):`, 40, { size: 10 });
  drawText(ctx, fmtEur(totals.ausgaben), 320, { size: 10 });
  ctx.y -= 14;
  drawText(ctx, `Umsatzsteuer:`, 40, { size: 10 });
  drawText(ctx, fmtEur(totals.ust), 320, { size: 10 });
  ctx.y -= 14;
  drawText(ctx, `Vorsteuer:`, 40, { size: 10 });
  drawText(ctx, fmtEur(totals.vorsteuer), 320, { size: 10 });
  ctx.y -= 18;
  drawText(ctx, `EÜR-Ergebnis (vor Steuern):`, 40, { size: 11, bold: true });
  drawText(ctx, fmtEur(totals.ergebnis), 320, { size: 11, bold: true });

  return await ctx.doc.save();
}

async function buildUStVAPdf(kz: Record<string, number>, mandant: string, monat: string): Promise<Uint8Array> {
  const ctx = await newPdf();
  drawHeader(ctx, "Umsatzsteuer-Voranmeldung (UStVA)", mandant, monat);

  drawText(ctx, "Steuerpflichtige Umsätze", 40, { size: 11, bold: true });
  ctx.y -= 16;
  const rows: [string, string, number][] = [
    ["KZ 81", "Lieferungen / Leistungen 19% (Bemessungsgrundlage)", kz["81"] ?? 0],
    ["", "  davon Umsatzsteuer 19%", kz["81_steuer"] ?? 0],
    ["KZ 86", "Lieferungen / Leistungen 7% (Bemessungsgrundlage)", kz["86"] ?? 0],
    ["", "  davon Umsatzsteuer 7%", kz["86_steuer"] ?? 0],
    ["KZ 35", "Steuerfreie Umsätze (0%)", kz["35"] ?? 0],
  ];
  for (const [k, label, val] of rows) {
    ensureSpace(ctx, 14);
    drawText(ctx, k, 40, { size: 10, bold: true });
    drawText(ctx, label, 100, { size: 10 });
    drawText(ctx, fmtEur(val), 460, { size: 10 });
    ctx.y -= 14;
  }

  ctx.y -= 10;
  drawText(ctx, "Vorsteuer", 40, { size: 11, bold: true });
  ctx.y -= 16;
  ensureSpace(ctx, 14);
  drawText(ctx, "KZ 66", 40, { size: 10, bold: true });
  drawText(ctx, "Abziehbare Vorsteuer aus Rechnungen", 100, { size: 10 });
  drawText(ctx, fmtEur(kz["66"] ?? 0), 460, { size: 10 });
  ctx.y -= 22;

  drawLine(ctx, ctx.y);
  ctx.y -= 20;
  const zahllast = kz["83"] ?? 0;
  const isErstattung = zahllast < 0;
  drawText(ctx, "KZ 83", 40, { size: 12, bold: true });
  drawText(
    ctx,
    isErstattung ? "Erstattung vom Finanzamt" : "Zahllast an Finanzamt",
    100,
    { size: 12, bold: true },
  );
  drawText(ctx, fmtEur(Math.abs(zahllast)), 460, {
    size: 12,
    bold: true,
    color: isErstattung ? rgb(0, 0.5, 0) : rgb(0.7, 0, 0),
  });

  ctx.y -= 30;
  drawText(
    ctx,
    "Hinweis: Diese Auswertung dient als Vorbereitung für die ELSTER-Übermittlung.",
    40,
    { size: 8, color: rgb(0.5, 0.5, 0.5) },
  );

  return await ctx.doc.save();
}

async function buildBelegVerzeichnisPdf(
  belege: { id: string; dateiname: string; erstellt_am: string }[],
  buchungenByDok: Map<string, BuchungRow[]>,
  mandant: string,
  monat: string,
): Promise<Uint8Array> {
  const ctx = await newPdf();
  drawHeader(ctx, "Beleg-Verzeichnis", mandant, monat);

  drawText(ctx, "Nr.", 40, { size: 9, bold: true });
  drawText(ctx, "Beleg-Datei", 80, { size: 9, bold: true });
  drawText(ctx, "Hochgeladen", 320, { size: 9, bold: true });
  drawText(ctx, "Verbuchte Beträge", 420, { size: 9, bold: true });
  ctx.y -= 12;
  drawLine(ctx, ctx.y);
  ctx.y -= 12;

  let nr = 1;
  for (const b of belege) {
    ensureSpace(ctx, 14);
    const bs = buchungenByDok.get(b.id) ?? [];
    const summe = bs.reduce((s, x) => s + Number(x.betrag), 0);
    drawText(ctx, String(nr), 40, { size: 9 });
    drawText(ctx, b.dateiname.slice(0, 40), 80, { size: 9 });
    drawText(ctx, fmtDate(b.erstellt_am), 320, { size: 9 });
    drawText(ctx, bs.length === 0 ? "— nicht gebucht —" : `${bs.length}× / ${fmtEur(summe)}`, 420, {
      size: 9,
      color: bs.length === 0 ? rgb(0.7, 0, 0) : rgb(0, 0, 0),
    });
    ctx.y -= 13;
    nr++;
  }

  return await ctx.doc.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth-Client (User)
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await authClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-Client (für Storage + DB)
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const buchhaltungId: string = body.buchhaltungId;
    if (!buchhaltungId) {
      return new Response(JSON.stringify({ error: "buchhaltungId fehlt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // benutzer.id aus user_id holen
    const { data: benutzerRow } = await admin
      .from("benutzer")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!benutzerRow) {
      return new Response(JSON.stringify({ error: "Benutzer nicht gefunden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buchhaltung + Mandant laden
    const { data: bh, error: bhErr } = await admin
      .from("buchhaltungen")
      .select("id, monat, status, mandant_id, mandanten(name, firma)")
      .eq("id", buchhaltungId)
      .maybeSingle();
    if (bhErr || !bh) {
      return new Response(JSON.stringify({ error: "Buchhaltung nicht gefunden" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mandant = (bh as any).mandanten?.firma || (bh as any).mandanten?.name || "Mandant";

    // Belege + Buchungen laden
    const { data: belege } = await admin
      .from("buchhaltung_dokumente")
      .select("id, dateiname, erstellt_am")
      .eq("buchhaltung_id", buchhaltungId)
      .order("erstellt_am", { ascending: true });

    const { data: buchungen } = await admin
      .from("buchungen")
      .select("id, buchungsdatum, lieferant, konto, kategorie, betrag, beschreibung, mwst_satz, dokument_id")
      .eq("buchhaltung_id", buchhaltungId);

    const buchungenList = (buchungen ?? []) as BuchungRow[];
    const belegeList = (belege ?? []) as { id: string; dateiname: string; erstellt_am: string }[];

    // Validierung: alle Belege gebucht?
    const gebucheteDokIds = new Set(buchungenList.map((b) => b.dokument_id).filter(Boolean));
    const ungebucht = belegeList.filter((b) => !gebucheteDokIds.has(b.id));
    if (ungebucht.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Es sind noch nicht alle Belege gebucht",
          ungebuchteBelege: ungebucht.map((b) => b.dateiname),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (buchungenList.length === 0) {
      return new Response(JSON.stringify({ error: "Keine Buchungen vorhanden" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Berechnungen
    const susaMap = new Map<string, { konto: string; kategorie: string; netto: number; mwst: number; brutto: number; buchungen_anzahl: number }>();
    const ustva: Record<string, number> = { "81": 0, "81_steuer": 0, "86": 0, "86_steuer": 0, "35": 0, "66": 0, "83": 0 };
    let einN = 0, ausN = 0, ust = 0, vst = 0;

    for (const b of buchungenList) {
      const satz = Number(b.mwst_satz);
      const { netto, mwst } = nettoAusBrutto(Number(b.betrag), satz);
      const kat = b.kategorie === "Einnahme" ? "Einnahme" : "Ausgabe";
      const key = `${kat}::${b.konto}`;
      const ex = susaMap.get(key);
      if (ex) {
        ex.netto += netto; ex.mwst += mwst; ex.brutto += Number(b.betrag); ex.buchungen_anzahl++;
      } else {
        susaMap.set(key, { konto: b.konto, kategorie: kat, netto, mwst, brutto: Number(b.betrag), buchungen_anzahl: 1 });
      }
      if (kat === "Einnahme") {
        einN += netto; ust += mwst;
        if (satz === 19) { ustva["81"] += netto; ustva["81_steuer"] += mwst; }
        else if (satz === 7) { ustva["86"] += netto; ustva["86_steuer"] += mwst; }
        else { ustva["35"] += netto; }
      } else {
        ausN += netto; vst += mwst;
        ustva["66"] += mwst;
      }
    }
    for (const k of Object.keys(ustva)) ustva[k] = Math.round(ustva[k] * 100) / 100;
    ustva["83"] = Math.round((ustva["81_steuer"] + ustva["86_steuer"] - ustva["66"]) * 100) / 100;

    const susaKonten = Array.from(susaMap.values()).map((k) => ({
      ...k,
      netto: Math.round(k.netto * 100) / 100,
      mwst: Math.round(k.mwst * 100) / 100,
      brutto: Math.round(k.brutto * 100) / 100,
    }));
    susaKonten.sort((a, b) => {
      if (a.kategorie !== b.kategorie) return a.kategorie === "Einnahme" ? -1 : 1;
      return b.brutto - a.brutto;
    });

    const totals = {
      einnahmen: Math.round(einN * 100) / 100,
      ausgaben: Math.round(ausN * 100) / 100,
      vorsteuer: Math.round(vst * 100) / 100,
      ust: Math.round(ust * 100) / 100,
      ergebnis: Math.round((einN - ausN) * 100) / 100,
    };

    const buchungenByDok = new Map<string, BuchungRow[]>();
    for (const b of buchungenList) {
      if (!b.dokument_id) continue;
      const arr = buchungenByDok.get(b.dokument_id) ?? [];
      arr.push(b);
      buchungenByDok.set(b.dokument_id, arr);
    }

    // PDFs bauen
    const [journalPdf, susaPdf, ustvaPdf, belegPdf] = await Promise.all([
      buildJournalPdf(buchungenList, mandant, bh.monat),
      buildSuSaPdf(susaKonten, totals, mandant, bh.monat),
      buildUStVAPdf(ustva, mandant, bh.monat),
      buildBelegVerzeichnisPdf(belegeList, buchungenByDok, mandant, bh.monat),
    ]);

    // Komplett-Paket: alle PDFs zusammenfügen
    const paket = await PDFDocument.create();
    for (const pdfBytes of [ustvaPdf, susaPdf, journalPdf, belegPdf]) {
      const src = await PDFDocument.load(pdfBytes);
      const pages = await paket.copyPages(src, src.getPageIndices());
      for (const p of pages) paket.addPage(p);
    }
    const paketPdf = await paket.save();

    // Upload
    const folder = `${buchhaltungId}/${Date.now()}`;
    const uploads = [
      { key: "journal", bytes: journalPdf, name: "Buchungsjournal.pdf" },
      { key: "susa", bytes: susaPdf, name: "Summen-Salden-Liste.pdf" },
      { key: "ustva", bytes: ustvaPdf, name: "Umsatzsteuer-Voranmeldung.pdf" },
      { key: "paket", bytes: paketPdf, name: "Buchhaltungs-Paket.pdf" },
    ];
    const pfade: Record<string, string> = {};
    for (const u of uploads) {
      const path = `${folder}/${u.name}`;
      const { error } = await admin.storage.from("buchhaltungen").upload(path, u.bytes, {
        contentType: "application/pdf",
        upsert: true,
      });
      if (error) throw new Error(`Upload ${u.name}: ${error.message}`);
      pfade[u.key] = path;
    }

    // Snapshot speichern (upsert über buchhaltung_id)
    const { data: existing } = await admin
      .from("buchhaltungs_abschluesse")
      .select("id")
      .eq("buchhaltung_id", buchhaltungId)
      .maybeSingle();

    const snapshot = {
      buchhaltung_id: buchhaltungId,
      erstellt_von: benutzerRow.id,
      erstellt_am: new Date().toISOString(),
      journal_pdf_pfad: pfade["journal"],
      susa_pdf_pfad: pfade["susa"],
      ustva_pdf_pfad: pfade["ustva"],
      paket_pdf_pfad: pfade["paket"],
      ustva_kennziffern: ustva,
      susa_data: { konten: susaKonten, totals },
      journal_data: buchungenList.map((b, i) => ({ nr: i + 1, ...b })),
    };

    if (existing) {
      await admin.from("buchhaltungs_abschluesse").update(snapshot).eq("id", existing.id);
    } else {
      await admin.from("buchhaltungs_abschluesse").insert(snapshot);
    }

    // Status auf "In Prüfung" setzen
    await admin.from("buchhaltungen").update({ status: "In Prüfung" }).eq("id", buchhaltungId);

    return new Response(JSON.stringify({ success: true, pfade }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("buchhaltung-abschliessen error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
