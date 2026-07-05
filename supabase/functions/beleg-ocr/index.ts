// Belegerkennung via KI-Gateway (google/gemini-2.5-pro mit PDF-Vision)
// Liest Betrag, Datum, Lieferant, MwSt-Satz, Kategorie, Konto und Beschreibung aus einem PDF-Beleg.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Konten-Liste (muss synchron mit src/lib/konten.ts gehalten werden)
const KONTEN_EINNAHMEN = [
  "Erlöse Dienstleistungen 19%",
  "Erlöse IT-Leistungen 19%",
  "Erlöse Warenverkauf 19%",
  "Erlöse Warenverkauf 7%",
  "Sonstige Erträge",
];
const KONTEN_AUSGABEN = [
  "Wareneinkauf",
  "Fremdleistungen",
  "Softwarekosten / SaaS-Abos",
  "IT-Leistungen / Hosting",
  "Werbekosten / Online-Marketing",
  "Beratungskosten Recht",
  "Beratungskosten Steuer",
  "Beratungskosten Unternehmen",
  "Büromaterial",
  "Telekommunikation",
  "Mietkosten Geschäftsräume",
  "Reisekosten Bahn/Flug",
  "Reisekosten Kfz/Tankstelle",
  "Bewirtungskosten",
  "Versicherungen",
  "Bankgebühren",
  "Sonstige betriebliche Aufwendungen",
];

const SYSTEM_PROMPT = `Du bist ein Experte für deutsche Buchhaltung und arbeitest für einen Steuerberater. Du analysierst PDF-Belege (Rechnungen, Quittungen, Kassenzettel) und extrahierst die wichtigsten Buchungsdaten so vollständig wie möglich, damit der Sachbearbeiter so wenig wie möglich manuell nacharbeiten muss.

GRUNDPRINZIP: FÜLLE SO VIELE FELDER WIE MÖGLICH AUS. Lass nur weg, was wirklich nicht lesbar ist. Lieber eine plausible Annahme als ein leeres Feld — der Sachbearbeiter korrigiert ggf. nach.

Regeln:
- betrag: IMMER der Brutto-Gesamtbetrag (inkl. MwSt) in Euro als Zahl, z.B. 89.99. Bei mehreren Beträgen den finalen Rechnungsbetrag (oft "Gesamtbetrag", "Summe", "Zahlbetrag", "Total").
- netto_betrag: NUR ausfüllen, wenn auf dem Beleg der Nettobetrag EXPLIZIT als eigene Zahl steht (z.B. "Nettobetrag: 470,00 €" oder "Zwischensumme netto"). Nicht selbst rechnen — bei Quittungen ohne separate Netto-Zeile leer lassen.
- mwst_betrag: NUR ausfüllen, wenn der MwSt-Betrag in Euro EXPLIZIT auf dem Beleg steht (z.B. "MwSt 19%: 89,30 €" oder "USt-Betrag: 89,30 €"). Nicht selbst rechnen.
- WICHTIG: Wenn Beleg Netto + MwSt + Brutto getrennt ausweist → ALLE DREI Felder (netto_betrag, mwst_betrag, betrag) füllen — exakt wie auf dem Beleg, keine Rundung. Wenn nur ein Gesamtbetrag erkennbar → nur betrag füllen, netto_betrag und mwst_betrag weglassen (Frontend rechnet).
- buchungsdatum: Belegdatum / Rechnungsdatum bevorzugt, fallback Leistungsdatum. NIEMALS Druck-/Zahlungs-/Fälligkeitsdatum. Format: YYYY-MM-DD.
- lieferant: Aussteller des Belegs (die Firma die die Rechnung stellt), nicht der Empfänger. Verwende den vollen Firmennamen, z.B. "Telekom Deutschland GmbH".
- mwst_satz: Nur 0, 7 oder 19 (deutsche Standardsätze). Wenn nicht explizit angegeben, LEITE AB aus Branche/Lieferant:
  • Restaurant, Lebensmittel, Bücher, Zeitschriften, Hotelübernachtung → 7
  • Software, B2B-Dienstleistung, Büromaterial, Elektronik, Handwerker, Beratung, Telekommunikation → 19
  • Versicherung, Miete (Wohnraum), Bank-/Finanzdienstleistung, ärztliche Leistung → 0
  • Im Zweifel: 19 (Standard-Satz Deutschland)
- kategorie: "Ausgabe" oder "Einnahme". ENTSCHEIDE anhand der Position des MANDANTEN auf dem Beleg:
  • Mandant ist AUSSTELLER/ABSENDER (oben im Briefkopf, "Von:", Logo) → kategorie = "Einnahme" (Ausgangsrechnung, eigener Umsatz)
  • Mandant ist EMPFÄNGER/KUNDE/RECHNUNGSEMPFÄNGER (unter "An:", "Rechnung an:", "Kunde:") → kategorie = "Ausgabe" (Eingangsrechnung)
  • Nur wenn der Mandant nicht eindeutig zuzuordnen ist → default "Ausgabe".
- beschreibung: IMMER ausfüllen, max 80 Zeichen, was wurde gekauft/geleistet. Notfalls aus Lieferant ableiten.
- konto: WÄHLE GENAU EINEN Kontonamen aus dieser exakten Liste:
  Einnahmen: ${KONTEN_EINNAHMEN.join(", ")}
  Ausgaben: ${KONTEN_AUSGABEN.join(", ")}
  
  SPEZIFITÄTS-REGEL (sehr wichtig): Wähle IMMER das spezifischste passende Konto. Verwende ein allgemeines Konto wie "Sonstige betriebliche Aufwendungen" NUR, wenn keine spezifische Kategorie passt. "Beratungskosten" NUR, wenn es wirklich klassische Beratung im Sinne von intellektueller Empfehlung ist (Anwalt, Steuerberater, Unternehmensberater) — KEINE IT-Dienstleistung, Marketing-Agentur, Software oder Hosting!
  
  Mapping-Regeln (Lieferant/Leistung → exaktes Konto):
  
  SOFTWARE & IT:
  • Adobe, Microsoft 365, Office 365, Notion, Slack, Zoom, GitHub, GitLab, Figma, Canva, Atlassian, Jira, Confluence, Dropbox, Google Workspace, Apple iCloud, Spotify Business, Asana, Monday → "Softwarekosten / SaaS-Abos"
  • AWS, Amazon Web Services, Hetzner, Cloudflare, IONOS Hosting, Strato, Vercel, Netlify, DigitalOcean, Heroku, Domain-Registrar, Server, Webhosting, Managed Hosting → "IT-Leistungen / Hosting"
  
  MARKETING & WERBUNG:
  • Google Ads, Google AdWords, Meta Ads, Facebook Ads, Instagram Ads, LinkedIn Ads, TikTok Ads, Bing Ads, Werbung, Marketing-Agentur, Anzeige, SEO-Agentur, Social-Media-Agentur, Influencer → "Werbekosten / Online-Marketing"
  
  BERATUNG (nur echte Beratungsleistung!):
  • Notar, Rechtsanwalt, Anwalt, Kanzlei (Recht), Gerichtskosten → "Beratungskosten Recht"
  • Steuerberater, StB-Kanzlei, DATEV-Beratung, Lohnbuchhaltung extern → "Beratungskosten Steuer"
  • Unternehmensberater, Strategie-Consulting, McKinsey, BCG, Coach (Business) → "Beratungskosten Unternehmen"
  
  TELEKOMMUNIKATION:
  • Telekom, Vodafone, 1&1, O2, Telefónica, Mobilfunk, DSL, Festnetz, Internet-Anschluss → "Telekommunikation"
  
  REISE & FAHRT:
  • Deutsche Bahn, DB, Lufthansa, Eurowings, Hotel, Booking.com, Airbnb (geschäftlich), Taxi, Uber → "Reisekosten Bahn/Flug"
  • Shell, Aral, Esso, Total, Jet, Tankstelle, Benzin, Diesel, Kfz-Werkstatt, Parkgebühr → "Reisekosten Kfz/Tankstelle"
  
  BEWIRTUNG:
  • Restaurant, Café, Gasthaus, Bistro, Catering, Geschäftsessen → "Bewirtungskosten"
  
  VERSICHERUNG & MIETE & BANK:
  • Allianz, AXA, HUK, Versicherung, Haftpflicht, Berufshaftpflicht, Inhaltsversicherung → "Versicherungen"
  • Vermieter, Hausverwaltung, Miete Büro, Pacht, Gewerbemiete, Nebenkostenabrechnung Gewerbe → "Mietkosten Geschäftsräume"
  • Sparkasse, Bank, Kontoführungsgebühr, Überweisungsgebühr, Kreditkarten-Jahresgebühr → "Bankgebühren"
  
  SACHKOSTEN:
  • Staples, Office Discount, Papier, Drucker, Toner, Tinte, Schreibwaren, Ordner → "Büromaterial"
  • Großhandel, Lieferant von Handelsware, Wareneinkauf zur Weiterveräußerung → "Wareneinkauf"
  • Subunternehmer, Freelancer (extern beauftragt), Werkvertrag, Fremdarbeit → "Fremdleistungen"
  
  EINNAHMEN:
  • Eigene Ausgangsrechnung für IT-Leistung / Software-Entwicklung / Hosting-Verkauf 19% → "Erlöse IT-Leistungen 19%"
  • Eigene Ausgangsrechnung allgemeine Dienstleistung 19% → "Erlöse Dienstleistungen 19%"
  • Eigene Ausgangsrechnung Warenverkauf 19% → "Erlöse Warenverkauf 19%"
  • Eigene Ausgangsrechnung Warenverkauf 7% (Bücher, Lebensmittel) → "Erlöse Warenverkauf 7%"
  • Zinsen, Erstattungen, sonstige Erträge → "Sonstige Erträge"
  
  FALLBACK:
  • Nur wenn wirklich nichts anderes passt: "Sonstige betriebliche Aufwendungen" — NICHT als Default verwenden!
- konfidenz: "hoch" wenn alle Pflichtfelder klar lesbar, "mittel" bei einzelnen Unsicherheiten oder Ableitungen, "niedrig" wenn Beleg schwer lesbar / viel geraten.`;

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "extract_beleg_daten",
    description: "Extrahiert die strukturierten Buchungsdaten aus einem PDF-Beleg.",
    parameters: {
      type: "object",
      properties: {
        betrag: {
          type: "number",
          description: "Brutto-Gesamtbetrag in Euro als Zahl, z.B. 89.99",
        },
        netto_betrag: {
          type: "number",
          description: "Nettobetrag in Euro — NUR wenn auf dem Beleg explizit als eigene Zahl angegeben (nicht selbst rechnen).",
        },
        mwst_betrag: {
          type: "number",
          description: "MwSt-Betrag in Euro — NUR wenn auf dem Beleg explizit ausgewiesen (nicht selbst rechnen).",
        },
        buchungsdatum: {
          type: "string",
          description: "Belegdatum im Format YYYY-MM-DD",
        },
        lieferant: {
          type: "string",
          description: "Name der ausstellenden Firma (Aussteller des Belegs)",
        },
        mwst_satz: {
          type: "number",
          description: "MwSt-Satz in Prozent: 0, 7 oder 19",
        },
        kategorie: {
          type: "string",
          description: "Entweder 'Einnahme' oder 'Ausgabe'",
        },
        beschreibung: {
          type: "string",
          description: "Kurze Beschreibung der Leistung/Ware (max 80 Zeichen)",
        },
        konto: {
          type: "string",
          description: "Vorgeschlagenes Konto aus der vorgegebenen Liste",
        },
        konfidenz: {
          type: "string",
          description: "Wie sicher die Extraktion ist: 'hoch', 'mittel' oder 'niedrig'",
        },
      },
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "KI-Gateway nicht konfiguriert. Bitte Administrator kontaktieren." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const dokumentId: string | undefined = body.dokument_id;
    const force: boolean = body.force === true;
    const mandantName: string | null = typeof body.mandant_name === "string" ? body.mandant_name : null;
    const mandantFirma: string | null = typeof body.mandant_firma === "string" ? body.mandant_firma : null;
    if (!dokumentId || typeof dokumentId !== "string") {
      return new Response(JSON.stringify({ error: "dokument_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: doc, error: docErr } = await admin
      .from("buchhaltung_dokumente")
      .select("id, dateipfad, dateiname, ocr_data, ocr_status")
      .eq("id", dokumentId)
      .maybeSingle();

    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!force && doc.ocr_status === "done" && doc.ocr_data) {
      return new Response(
        JSON.stringify({ cached: true, data: doc.ocr_data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: fileData, error: dlErr } = await admin.storage
      .from("belege")
      .download(doc.dateipfad);
    if (dlErr || !fileData) {
      console.error("Storage download failed:", dlErr);
      return new Response(JSON.stringify({ error: "Could not download PDF" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(
        null,
        Array.from(bytes.subarray(i, i + chunkSize)),
      );
    }
    const base64 = btoa(binary);
    const dataUrl = `data:application/pdf;base64,${base64}`;

    const callGateway = async (model: string) => {
      const mandantContext = (mandantName || mandantFirma)
        ? `WICHTIGER KONTEXT — DER MANDANT (Buchhaltungs-Inhaber):\nName: ${mandantName ?? "(unbekannt)"}\nFirma: ${mandantFirma ?? "(keine)"}\n\nPrüfe auf dem Beleg, wo dieser Mandant erscheint:\n• Steht der Mandant OBEN im Briefkopf / als Absender / Aussteller der Rechnung? → Es ist eine Ausgangsrechnung des Mandanten → kategorie = "Einnahme" und wähle ein passendes "Erlöse..."-Konto.\n• Steht der Mandant UNTEN als Rechnungsempfänger / Kunde / "An:" / "Rechnung an:"? → Es ist eine Eingangsrechnung → kategorie = "Ausgabe".\n• Wenn unklar → default "Ausgabe".\n\n`
        : "";
      return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `${mandantContext}Bitte extrahiere die Buchungsdaten aus diesem Beleg. Wähle das passende Konto aus der vorgegebenen Liste und fülle alle Felder so vollständig wie möglich aus.`,
                },
                {
                  type: "image_url",
                  image_url: { url: dataUrl },
                },
              ],
            },
          ],
          tools: [TOOL_SCHEMA],
          tool_choice: { type: "function", function: { name: "extract_beleg_daten" } },
        }),
      });
    };

    let aiResponse = await callGateway("google/gemini-2.5-pro");

    // Fallback: bei 400 (Schema-Validierung) auf flash umschwenken
    if (aiResponse.status === 400) {
      const errBody = await aiResponse.text();
      console.error("Gemini 2.5 pro 400 — falling back to flash. Body:", errBody);
      aiResponse = await callGateway("google/gemini-2.5-flash");
    }

    if (aiResponse.status === 429) {
      await admin
        .from("buchhaltung_dokumente")
        .update({ ocr_status: "failed", ocr_am: new Date().toISOString() })
        .eq("id", dokumentId);
      return new Response(
        JSON.stringify({
          error: "Rate-Limit erreicht. Bitte einen Moment warten und erneut versuchen.",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (aiResponse.status === 402) {
      return new Response(
        JSON.stringify({
          error:
            "KI-Credits aufgebraucht. Bitte Administrator kontaktieren.",
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      await admin
        .from("buchhaltung_dokumente")
        .update({ ocr_status: "failed", ocr_am: new Date().toISOString() })
        .eq("id", dokumentId);
      return new Response(
        JSON.stringify({ error: `AI gateway error (${aiResponse.status}): ${errText.slice(0, 200)}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiResponse.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool_call in AI response. Full response:", JSON.stringify(aiJson).slice(0, 1000));
      await admin
        .from("buchhaltung_dokumente")
        .update({ ocr_status: "failed", ocr_am: new Date().toISOString() })
        .eq("id", dokumentId);
      return new Response(
        JSON.stringify({ error: "Keine strukturierte Antwort von der KI erhalten." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let extracted: Record<string, unknown>;
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Failed to parse tool args:", toolCall.function.arguments);
      return new Response(
        JSON.stringify({ error: "Ungültige KI-Antwort." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Normalisierung: kategorie validieren
    if (extracted.kategorie && extracted.kategorie !== "Einnahme" && extracted.kategorie !== "Ausgabe") {
      delete extracted.kategorie;
    }
    // mwst_satz auf erlaubte Werte normieren
    if (typeof extracted.mwst_satz === "number") {
      const allowed = [0, 7, 19];
      if (!allowed.includes(extracted.mwst_satz)) {
        // Auf nächsten erlaubten Wert runden
        extracted.mwst_satz = allowed.reduce((prev, curr) =>
          Math.abs(curr - (extracted.mwst_satz as number)) < Math.abs(prev - (extracted.mwst_satz as number)) ? curr : prev
        );
      }
    }
    // konto validieren — muss in Liste sein
    const allKonten = [...KONTEN_EINNAHMEN, ...KONTEN_AUSGABEN];
    if (extracted.konto && !allKonten.includes(extracted.konto as string)) {
      console.warn("KI schlug ungültiges Konto vor:", extracted.konto);
      delete extracted.konto;
    }
    // Defensive: konfidenz default
    if (!extracted.konfidenz) {
      extracted.konfidenz = "mittel";
    }
    // Validate netto_betrag and mwst_betrag — must be non-negative numbers if present
    if (extracted.netto_betrag !== undefined && (typeof extracted.netto_betrag !== "number" || extracted.netto_betrag < 0)) {
      delete extracted.netto_betrag;
    }
    if (extracted.mwst_betrag !== undefined && (typeof extracted.mwst_betrag !== "number" || extracted.mwst_betrag < 0)) {
      delete extracted.mwst_betrag;
    }
    // Plausibility: netto + mwst should approx equal betrag (1-cent tolerance)
    if (
      typeof extracted.netto_betrag === "number" &&
      typeof extracted.mwst_betrag === "number" &&
      typeof extracted.betrag === "number"
    ) {
      const sum = extracted.netto_betrag + extracted.mwst_betrag;
      if (Math.abs(sum - extracted.betrag) > 0.05) {
        console.warn("netto+mwst mismatch betrag:", sum, "vs", extracted.betrag, "— dropping netto/mwst");
        delete extracted.netto_betrag;
        delete extracted.mwst_betrag;
      }
    }

    console.log("OCR extrahiert:", JSON.stringify(extracted));

    await admin
      .from("buchhaltung_dokumente")
      .update({
        ocr_data: extracted,
        ocr_status: "done",
        ocr_am: new Date().toISOString(),
      })
      .eq("id", dokumentId);

    return new Response(
      JSON.stringify({ cached: false, data: extracted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("beleg-ocr error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
