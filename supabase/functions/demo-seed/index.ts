// Demo seed: creates demo users (Sekretariat / Sachbearbeiter / Chef) and
// realistic sample data: 150 Mandanten, 80 erledigte + 20 überzogene + 50 offene Buchhaltungen.
// Alle Datumsangaben werden relativ zum Seed-Zeitpunkt berechnet (rollierendes Fenster).
// Idempotent - safe to call multiple times. Public function (demo purpose).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEMO_PASSWORD = "demo-pewand-2026!";

const ROLE_USERS = [
  { email: "demo-sekretariat@pewand-demo.de", name: "Sabine Sekretariat", rolle: "Sekretariat" },
  { email: "demo-sachbearbeiter@pewand-demo.de", name: "Simon Sachbearbeiter", rolle: "Sachbearbeiter" },
  { email: "demo-chef@pewand-demo.de", name: "Christina Chef", rolle: "Chef" },
] as const;


function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// PRNG (seeded für reproduzierbare Demo-Daten)
let seed = 42;
function rand() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
function pick<T>(arr: T[]): T { return arr[Math.floor(rand() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(rand() * (max - min + 1)) + min; }

const VORNAMEN = ["Peter","Anna","Michael","Julia","Marco","Sven","Thomas","Lena","Klaus","Sabrina","Andreas","Nicole","Stefan","Petra","Jürgen","Silvia","Frank","Martina","Uwe","Katrin","Ralf","Sandra","Dirk","Kerstin","Oliver","Birgit","Markus","Susanne","Rainer","Angelika","Hans","Monika","Wolfgang","Claudia","Bernd","Barbara","Werner","Ingrid","Manfred","Renate"];
const NACHNAMEN = ["Krause","Meier","Weber","Schmidt","Rossi","Larsen","Fischer","Müller","Schneider","Fischer","Wagner","Becker","Schulz","Hoffmann","Koch","Bauer","Richter","Klein","Wolf","Neumann","Schwarz","Zimmermann","Braun","Krüger","Hofmann","Hartmann","Lange","Schmitt","Werner","Krause","Lehmann","Schmid","Schulze","Maier","Köhler","Herrmann","König","Walter","Mayer","Huber"];
const FIRMEN_PREFIX = ["Bäckerei","Metzgerei","Autohaus","Praxis","Kanzlei","Consulting","Software","Handwerk","Restaurant","Café","Studio","Werkstatt","Zentrum","Boutique","Apotheke","Fitness","Reisebüro","Immobilien","Logistik","Bau"];
const FIRMEN_SUFFIX = ["Nord","Süd","West","Ost","City","Central","Premium","Express","Classic","Modern","Family","24","Elite","Top","Prime"];
const RECHTSFORMEN = ["GmbH","UG","Einzelunternehmen","Freiberufler","GmbH & Co. KG","GbR","AG"];
const STAEDTE: Array<[string, string]> = [
  ["10115","Berlin"],["20359","Hamburg"],["80539","München"],["50667","Köln"],["60311","Frankfurt am Main"],
  ["70173","Stuttgart"],["40212","Düsseldorf"],["04109","Leipzig"],["44135","Dortmund"],["45127","Essen"],
  ["28195","Bremen"],["30159","Hannover"],["90402","Nürnberg"],["47051","Duisburg"],["24103","Kiel"],
  ["01067","Dresden"],["44799","Bochum"],["42103","Wuppertal"],["33602","Bielefeld"],["53111","Bonn"],
];
const STRASSEN = ["Hauptstr.","Bahnhofstr.","Marktplatz","Lindenweg","Königsallee","Ludwigstr.","Reeperbahn","Gartenstr.","Kirchweg","Schulstr.","Rathausplatz","Am Park","Ringstr.","Poststr.","Mühlenweg"];

async function findUserByEmail(svc: any, email: string): Promise<string | null> {
  let page = 1;
  while (true) {
    const { data } = await svc.auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users ?? [];
    if (users.length === 0) return null;
    const hit = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (users.length < 200) return null;
    page++;
  }
}

async function chunkedInsert(svc: any, table: string, rows: any[], chunk = 500) {
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error } = await svc.from(table).insert(slice);
    if (error) throw new Error(`insert ${table} chunk ${i}: ${error.message}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // ---- 1. Cleanup old demo data (Mandanten + abhängige Rows) ----
    const { data: oldMandanten } = await svc.from("mandanten").select("id").ilike("notizen", "[DEMO]%");
    const oldIds = (oldMandanten ?? []).map((m: any) => m.id);
    if (oldIds.length > 0) {
      const { data: oldBh } = await svc.from("buchhaltungen").select("id").in("mandant_id", oldIds);
      const bhIds = (oldBh ?? []).map((b: any) => b.id);
      const chunkIds = <T>(arr: T[], n = 200) => {
        const out: T[][] = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out;
      };
      for (const c of chunkIds(bhIds)) {
        await svc.from("belegeingaenge").delete().in("buchhaltung_id", c);
        await svc.from("buchhaltung_co_bearbeiter").delete().in("buchhaltung_id", c);
        await svc.from("kommentare").delete().in("buchhaltung_id", c);
        await svc.from("benachrichtigungen").delete().in("buchhaltung_id", c);
        await svc.from("buchhaltungen").delete().in("id", c);
      }
      for (const c of chunkIds(oldIds)) {
        await svc.from("mandanten").delete().in("id", c);
      }
    }

    // ---- 2. Ensure role users (idempotent: reuse existing, don't recreate) ----
    // Wichtig: User NICHT löschen, damit offene Browser-Sessions nach dem Reset weiterhin gültig sind.
    const userIds: Record<string, string> = {};
    for (const u of ROLE_USERS) {
      let uid = await findUserByEmail(svc, u.email);
      if (uid) {
        // Refresh password/meta but keep the same ID
        await svc.auth.admin.updateUserById(uid, {
          password: DEMO_PASSWORD,
          email_confirm: true,
          user_metadata: { name: u.name },
        });
      } else {
        const { data: created, error } = await svc.auth.admin.createUser({
          email: u.email, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { name: u.name },
        });
        if (error || !created.user) return j(500, { step: "createRoleUser", email: u.email, error: error?.message });
        uid = created.user.id;
      }
      userIds[u.rolle] = uid;
      // Rollen & Benutzer-Profil idempotent setzen
      await svc.from("user_roles").delete().eq("user_id", uid);
      await svc.from("user_roles").insert({ user_id: uid, role: u.rolle });
      await svc.from("benutzer").upsert(
        { user_id: uid, name: u.name, email: u.email },
        { onConflict: "user_id" },
      );
    }


    // ---- 3. Resolve role benutzer.id ----
    const { data: mainSb } = await svc.from("benutzer").select("id").eq("user_id", userIds["Sachbearbeiter"]).maybeSingle();
    const mainSbBid = mainSb!.id;
    const { data: chefB } = await svc.from("benutzer").select("id").eq("user_id", userIds["Chef"]).maybeSingle();
    const chefBid = chefB!.id;
    const { data: sekB } = await svc.from("benutzer").select("id").eq("user_id", userIds["Sekretariat"]).maybeSingle();
    const sekBid = sekB!.id;


    // ---- 4. Generate 150 Mandanten (alle Simon zugewiesen) ----
    const mandantenRows: any[] = [];
    for (let i = 0; i < 150; i++) {
      const vorname = pick(VORNAMEN);
      const nachname = pick(NACHNAMEN);
      const rechtsform = pick(RECHTSFORMEN);
      const [plz, ort] = pick(STAEDTE);
      const firma = rechtsform === "Freiberufler" || rechtsform === "Einzelunternehmen"
        ? `${nachname} ${pick(FIRMEN_PREFIX)}`
        : `${pick(FIRMEN_PREFIX)} ${pick(FIRMEN_SUFFIX)} ${rechtsform}`;
      const sbId = mainSbBid;
      mandantenRows.push({
        mandanten_nummer: `M-${i + 1}`,
        name: firma,
        firma,
        vorname, nachname,
        unternehmensform: rechtsform,
        strasse: `${pick(STRASSEN)} ${randInt(1, 199)}`,
        plz, ort,
        telefon: `0${randInt(151, 179)}-${randInt(1000000, 9999999)}`,
        email: `kontakt${i + 1}@${nachname.toLowerCase().replace(/[^a-z]/g, "")}-demo.de`,
        steuernummer: `${randInt(10, 99)}/${randInt(100, 999)}/${randInt(10000, 99999)}`,
        umsatzsteuer_id: rand() > 0.5 ? `DE${randInt(100000000, 999999999)}` : null,
        dauerfristverlaengerung: rand() > 0.5,
        notizen: "[DEMO] Beispiel-Mandant für die Live-Demo.",
        zugewiesener_bearbeiter_id: sbId,
      });
    }

    // Insert mandanten in chunks and collect ids
    const mandantenInfo: Array<{ id: string; sbId: string; dfv: boolean }> = [];
    for (let i = 0; i < mandantenRows.length; i += 100) {
      const slice = mandantenRows.slice(i, i + 100);
      const { data, error } = await svc.from("mandanten").insert(slice).select("id, zugewiesener_bearbeiter_id, dauerfristverlaengerung");
      if (error) return j(500, { step: "insertMandanten", error: error.message });
      for (const row of data!) {
        mandantenInfo.push({ id: row.id, sbId: row.zugewiesener_bearbeiter_id, dfv: row.dauerfristverlaengerung });
      }
    }

    // ---- 5. Build Buchhaltungen (alle Datumsangaben relativ zum Seed-Lauf) ----
    const buchhaltungRows: any[] = [];
    // Track per mandant which months already used
    const usedMonths: Record<string, Set<string>> = {};
    const monthKey = (y: number, m: number) => `${String(m).padStart(2, "0")}-${y}`;

    const NOW = new Date();
    const BASE_Y = NOW.getUTCFullYear();
    const BASE_M = NOW.getUTCMonth() + 1; // 1-12, M0 = Monat des Seed-Laufs
    // [Jahr, Monat] für "n Monate vor M0"
    function monthsAgo(n: number): [number, number] {
      const total = BASE_Y * 12 + (BASE_M - 1) - n;
      return [Math.floor(total / 12), (total % 12) + 1];
    }
    const iso = (d: Date) => d.toISOString().split("T")[0];
    const clampPast = (d: Date) => (d.getTime() > NOW.getTime() ? NOW : d);

    // Pool erledigter Monate: rollierendes Fenster M-4 bis M-21 (18 Monate)
    const erledigtMonths: Array<[number, number]> = [];
    for (let n = 4; n <= 21; n++) erledigtMonths.push(monthsAgo(n));

    // 80 erledigt: erste 80 Mandanten bekommen je 1 erledigte Buchhaltung
    const perMandantErledigt = Array(150).fill(0);
    for (let i = 0; i < 80; i++) perMandantErledigt[i] = 1;


    for (let mi = 0; mi < 150; mi++) {
      const m = mandantenInfo[mi];
      usedMonths[m.id] = new Set();
      const count = perMandantErledigt[mi];
      // Pick `count` different months from erledigtMonths, starting from a rotating offset
      for (let k = 0; k < count; k++) {
        const idx = (mi * 3 + k) % erledigtMonths.length;
        const [y, mo] = erledigtMonths[idx];
        const key = monthKey(y, mo);
        if (usedMonths[m.id].has(key)) continue;
        usedMonths[m.id].add(key);
        // Folgemonat des Buchhaltungsmonats, Tag 20-27, nie in der Zukunft
        const fertig = clampPast(new Date(Date.UTC(y, mo, 20 + randInt(0, 7))));
        buchhaltungRows.push({
          mandant_id: m.id,
          bearbeiter_id: m.sbId,
          monat: key,
          status: "Buchhaltung erledigt",
          fertiggestellt_datum: iso(fertig),
          dauerfristverlaengerung: m.dfv,
          faellig_am_manuell: false,
        });
      }
    }

    // 20 überzogen: Monate M-3 bis M-5, faellig_am 10-60 Tage in der Vergangenheit
    const overdueStatuses = ["In Bearbeitung", "Warten auf Mandant"];
    const overdueMonths: Array<[number, number]> = [monthsAgo(3), monthsAgo(4), monthsAgo(5)];
    for (let i = 0; i < 20; i++) {
      const m = mandantenInfo[i * 7 % 150];
      const [y, mo] = overdueMonths[i % overdueMonths.length];
      const key = monthKey(y, mo);
      if (usedMonths[m.id].has(key)) continue;
      usedMonths[m.id].add(key);
      const overdueDate = new Date();
      overdueDate.setDate(overdueDate.getDate() - randInt(10, 60));
      buchhaltungRows.push({
        mandant_id: m.id,
        bearbeiter_id: m.sbId,
        monat: key,
        status: overdueStatuses[i % 2],
        dauerfristverlaengerung: m.dfv,
        faellig_am: iso(overdueDate),
        faellig_am_manuell: true,
        notizen: i % 2 === 1 ? "Belege für diesen Monat noch nicht vollständig — Mandant wurde angeschrieben." : null,
      });
    }

    // 50 offen (noch Zeit): Monate M0, M-1, M-2 — Frist berechnet die App selbst
    const openStatuses = ["Eingegangen", "In Bearbeitung", "In Bearbeitung", "In Prüfung"];
    const openMonths: Array<[number, number]> = [monthsAgo(0), monthsAgo(1), monthsAgo(2)];
    for (let i = 0; i < 50; i++) {
      const m = mandantenInfo[(i * 11 + 3) % 150];
      const [y, mo] = openMonths[i % openMonths.length];
      const key = monthKey(y, mo);
      if (usedMonths[m.id].has(key)) continue;
      usedMonths[m.id].add(key);
      buchhaltungRows.push({
        mandant_id: m.id,
        bearbeiter_id: m.sbId,
        monat: key,
        status: openStatuses[i % openStatuses.length],
        dauerfristverlaengerung: m.dfv,
        faellig_am_manuell: false,
      });
    }

    // Insert buchhaltungen in chunks and collect ids + info for follow-ups
    const insertedBh: Array<{ id: string; sbId: string; status: string; monat: string }> = [];
    for (let i = 0; i < buchhaltungRows.length; i += 300) {
      const slice = buchhaltungRows.slice(i, i + 300);
      const { data, error } = await svc.from("buchhaltungen").insert(slice).select("id, bearbeiter_id, status, monat");
      if (error) return j(500, { step: "insertBH", offset: i, error: error.message });
      for (const row of data!) insertedBh.push({ id: row.id, sbId: row.bearbeiter_id, status: row.status, monat: row.monat });
    }

    // ---- 6. Belegeingänge (1-2 per buchhaltung, Datum passend zum Monat) ----
    const belegRows: any[] = [];
    for (const bh of insertedBh) {
      const [mmStr, yyStr] = bh.monat.split("-");
      const mm = Number(mmStr), yy = Number(yyStr);
      const anzahl = randInt(1, 2);
      for (let k = 0; k < anzahl; k++) {
        // ab Mitte des Buchhaltungsmonats bis in den Folgemonat hinein
        const d = clampPast(new Date(Date.UTC(yy, mm - 1, 15 + randInt(0, 30))));
        belegRows.push({
          buchhaltung_id: bh.id,
          datum: iso(d),
          notiz: pick(["Kontoauszüge per E-Mail", "Kassenbelege abgegeben", "Rechnungen digital eingereicht", "Belege in Kanzlei abgegeben"]),
          erstellt_von: bh.sbId,
        });
      }
    }
    await chunkedInsert(svc, "belegeingaenge", belegRows, 500);


    // ---- 7. Kommentare für "In Prüfung" ----
    const kommentarRows: any[] = [];
    for (const bh of insertedBh) {
      if (bh.status === "In Prüfung") {
        kommentarRows.push({
          buchhaltung_id: bh.id, user_id: bh.sbId,
          kommentar: "Belege sind komplett — bitte prüfen und freigeben.",
        });
      }
    }
    if (kommentarRows.length > 0) await chunkedInsert(svc, "kommentare", kommentarRows, 500);

    // ---- 8. Co-Bearbeiter für 12 Buchhaltungen (Chef als Zweitbearbeiter) ----
    const coRows: any[] = [];
    const coCount = 12;
    for (let i = 0; i < coCount; i++) {
      const bh = insertedBh[(i * 37 + 5) % insertedBh.length];
      coRows.push({ buchhaltung_id: bh.id, bearbeiter_id: chefBid, zugewiesen_von: chefBid });
    }
    const seen = new Set<string>();
    const dedupCo = coRows.filter((r) => {
      const k = `${r.buchhaltung_id}:${r.bearbeiter_id}`;
      if (seen.has(k)) return false; seen.add(k); return true;
    });
    if (dedupCo.length > 0) await chunkedInsert(svc, "buchhaltung_co_bearbeiter", dedupCo, 100);

    // ---- 9. Willkommens-Benachrichtigungen ----
    await svc.from("benachrichtigungen").insert([
      { empfaenger_id: chefBid, typ: "in_pruefung", titel: "Willkommen im Chef-Bereich",
        nachricht: "Hier siehst du alle Buchhaltungen, die zur Prüfung anstehen." },
      { empfaenger_id: sekBid, typ: "warten_auf_mandant", titel: "Willkommen im Sekretariat",
        nachricht: "Kontaktiere Mandanten, deren Belege noch fehlen." },
    ]);

    return j(200, {
      ok: true,
      sachbearbeiter: 1,
      mandanten: mandantenInfo.length,
      buchhaltungen: insertedBh.length,
      erledigt: insertedBh.filter((b) => b.status === "Buchhaltung erledigt").length,
      offen: insertedBh.filter((b) => b.status !== "Buchhaltung erledigt").length,
      co_bearbeiter: dedupCo.length,
    });

  } catch (e) {
    console.error("demo-seed error", e);
    return j(500, { error: (e as Error).message });
  }
});
