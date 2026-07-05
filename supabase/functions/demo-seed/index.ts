// Demo seed: creates 3 demo users (Sekretariat, Sachbearbeiter, Chef) and
// realistic sample data. Idempotent - safe to call multiple times.
// SECURITY: This function is intentionally public for demo purposes. It only
// operates on the fixed demo emails.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEMO_PASSWORD = "demo-taxom-2026!";

const DEMO_USERS = [
  { email: "demo-sekretariat@taxom-demo.de", name: "Sabine Sekretariat", rolle: "Sekretariat" },
  { email: "demo-sachbearbeiter@taxom-demo.de", name: "Simon Sachbearbeiter", rolle: "Sachbearbeiter" },
  { email: "demo-chef@taxom-demo.de", name: "Christina Chef", rolle: "Chef" },
] as const;

function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // ---- 1. Create/ensure demo users ----
    const userIds: Record<string, string> = {};
    for (const u of DEMO_USERS) {
      // Try to find existing
      const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
      let existing = list?.users.find((x) => x.email === u.email);
      if (!existing) {
        const { data: created, error } = await svc.auth.admin.createUser({
          email: u.email,
          password: DEMO_PASSWORD,
          email_confirm: true,
          user_metadata: { name: u.name },
        });
        if (error || !created.user) return j(500, { step: "createUser", email: u.email, error: error?.message });
        existing = created.user;
      } else {
        // ensure password is the demo password
        await svc.auth.admin.updateUserById(existing.id, { password: DEMO_PASSWORD });
      }
      userIds[u.rolle] = existing.id;
      // ensure role
      await svc.from("user_roles").delete().eq("user_id", existing.id);
      await svc.from("user_roles").insert({ user_id: existing.id, role: u.rolle });
      // ensure benutzer row
      await svc.from("benutzer").upsert(
        { user_id: existing.id, name: u.name, email: u.email },
        { onConflict: "user_id" },
      );
    }

    // Resolve benutzer.id
    const benutzerIds: Record<string, string> = {};
    for (const rolle of Object.keys(userIds)) {
      const { data } = await svc.from("benutzer").select("id").eq("user_id", userIds[rolle]).maybeSingle();
      benutzerIds[rolle] = data!.id;
    }
    const sachbearbeiterBid = benutzerIds["Sachbearbeiter"];
    const chefBid = benutzerIds["Chef"];

    // ---- 2. Wipe old demo data (only demo mandanten) ----
    // We tag demo mandanten via notizen prefix "[DEMO]"
    const { data: oldMandanten } = await svc.from("mandanten").select("id").ilike("notizen", "[DEMO]%");
    const oldIds = (oldMandanten ?? []).map((m: any) => m.id);
    if (oldIds.length > 0) {
      const { data: oldBh } = await svc.from("buchhaltungen").select("id").in("mandant_id", oldIds);
      const bhIds = (oldBh ?? []).map((b: any) => b.id);
      if (bhIds.length > 0) {
        await svc.from("buchungen").delete().in("buchhaltung_id", bhIds);
        await svc.from("belegeingaenge").delete().in("buchhaltung_id", bhIds);
        await svc.from("buchhaltungs_abschluesse").delete().in("buchhaltung_id", bhIds);
        await svc.from("buchhaltung_co_bearbeiter").delete().in("buchhaltung_id", bhIds);
        await svc.from("kommentare").delete().in("buchhaltung_id", bhIds);
        await svc.from("benachrichtigungen").delete().in("buchhaltung_id", bhIds);
        await svc.from("buchhaltungen").delete().in("id", bhIds);
      }
      await svc.from("mandanten").delete().in("id", oldIds);
    }

    // ---- 3. Seed Mandanten ----
    const mandantenSeed = [
      { name: "Bäckerei Krause GmbH", firma: "Bäckerei Krause GmbH", vorname: "Peter", nachname: "Krause",
        unternehmensform: "GmbH", strasse: "Hauptstr. 12", plz: "10115", ort: "Berlin",
        telefon: "030-12345678", email: "info@baeckerei-krause.de",
        steuernummer: "12/345/67890", umsatzsteuer_id: "DE123456789", dauerfristverlaengerung: true },
      { name: "Meier Consulting", firma: "Meier Consulting e.K.", vorname: "Anna", nachname: "Meier",
        unternehmensform: "Einzelunternehmen", strasse: "Königsallee 44", plz: "40212", ort: "Düsseldorf",
        telefon: "0211-9876543", email: "a.meier@meier-consulting.de",
        steuernummer: "13/456/78901", dauerfristverlaengerung: false },
      { name: "Dr. Weber Zahnarztpraxis", firma: "Zahnarztpraxis Dr. Weber", vorname: "Michael", nachname: "Weber",
        unternehmensform: "Freiberufler", strasse: "Ludwigstr. 8", plz: "80539", ort: "München",
        telefon: "089-2233445", email: "praxis@dr-weber.de",
        steuernummer: "143/567/89012" },
      { name: "TechStart UG", firma: "TechStart UG (haftungsbeschränkt)", vorname: "Julia", nachname: "Schmidt",
        unternehmensform: "UG", strasse: "Reeperbahn 100", plz: "20359", ort: "Hamburg",
        telefon: "040-5566778", email: "julia@techstart.io",
        steuernummer: "22/123/45678", umsatzsteuer_id: "DE987654321", dauerfristverlaengerung: true },
      { name: "Restaurant La Vita", firma: "La Vita GmbH & Co. KG", vorname: "Marco", nachname: "Rossi",
        unternehmensform: "GmbH & Co. KG", strasse: "Marktplatz 3", plz: "70173", ort: "Stuttgart",
        telefon: "0711-4433221", email: "info@la-vita.de",
        steuernummer: "97/234/56789" },
      { name: "Fitness Studio Nord", firma: "Fitness Nord GmbH", vorname: "Sven", nachname: "Larsen",
        unternehmensform: "GmbH", strasse: "Nordbahnhofstr. 22", plz: "24103", ort: "Kiel",
        telefon: "0431-7788990", email: "kontakt@fitness-nord.de",
        steuernummer: "20/345/67890", umsatzsteuer_id: "DE234567891", dauerfristverlaengerung: true },
      { name: "Handwerk Fischer", firma: "Fischer Sanitär & Heizung", vorname: "Thomas", nachname: "Fischer",
        unternehmensform: "Einzelunternehmen", strasse: "Lindenweg 5", plz: "50667", ort: "Köln",
        telefon: "0221-3344556", email: "buero@fischer-handwerk.de",
        steuernummer: "215/456/78901" },
    ];

    const mandantenIds: string[] = [];
    for (const m of mandantenSeed) {
      const { data, error } = await svc.from("mandanten").insert({
        ...m,
        notizen: "[DEMO] Beispiel-Mandant für die Live-Demo.",
        zugewiesener_bearbeiter_id: sachbearbeiterBid,
      }).select("id").single();
      if (error) return j(500, { step: "insertMandant", name: m.name, error: error.message });
      mandantenIds.push(data.id);
    }

    // ---- 4. Seed Buchhaltungen per mandant (multiple months, mixed status) ----
    const monate = ["01-2026", "02-2026", "03-2026", "04-2026", "05-2026"];
    // status per month (last month varies per mandant to create variety)
    const statuses: Array<"Buchhaltung erledigt" | "In Prüfung" | "In Bearbeitung" | "Warten auf Mandant" | "Eingegangen"> = [
      "Buchhaltung erledigt",
      "In Prüfung",
      "In Bearbeitung",
      "Warten auf Mandant",
      "Eingegangen",
    ];

    let insertedBh = 0;
    for (let mi = 0; mi < mandantenIds.length; mi++) {
      const mid = mandantenIds[mi];
      for (let i = 0; i < monate.length; i++) {
        // First 3 months: erledigt. Then vary.
        let status: any;
        if (i < 3) status = "Buchhaltung erledigt";
        else if (i === 3) status = statuses[(mi + 1) % statuses.length];
        else status = statuses[(mi + 3) % statuses.length];

        const zurueckgewiesen = mi === 0 && i === 4;
        if (zurueckgewiesen) status = "In Bearbeitung";

        const [mm, yyyy] = monate[i].split("-");
        const fertiggestellt = status === "Buchhaltung erledigt" ? `${yyyy}-${mm}-28` : null;

        const { data: bh, error: bhErr } = await svc.from("buchhaltungen").insert({
          mandant_id: mid,
          bearbeiter_id: sachbearbeiterBid,
          monat: monate[i],
          status,
          fertiggestellt_datum: fertiggestellt,
          notizen: status === "In Bearbeitung" && zurueckgewiesen
            ? "Bitte den Umsatz-Beleg aus KW 3 nachreichen — fehlt in den Unterlagen."
            : null,
          zurueckgewiesen_am: zurueckgewiesen ? new Date().toISOString() : null,
        }).select("id").single();
        if (bhErr) return j(500, { step: "insertBH", error: bhErr.message });
        insertedBh++;

        // Belegeingänge — als Referenz-Dokumentation
        const belege = [
          { datum: `${yyyy}-${mm}-05`, notiz: "Kontoauszug + Rechnungen per E-Mail" },
          { datum: `${yyyy}-${mm}-15`, notiz: "Kassenbelege abgegeben" },
        ];
        for (const b of belege) {
          await svc.from("belegeingaenge").insert({
            buchhaltung_id: bh.id, datum: b.datum, notiz: b.notiz, erstellt_von: sachbearbeiterBid,
          });
        }

        // Kommentare für "In Prüfung"
        if (status === "In Prüfung") {
          await svc.from("kommentare").insert({
            buchhaltung_id: bh.id, user_id: userIds["Sachbearbeiter"],
            kommentar: "Belege sind komplett — bitte prüfen und freigeben.",
          });
        }
      }
    }


    // Benachrichtigung an chef & sekretariat als Beispiel
    await svc.from("benachrichtigungen").insert([
      { empfaenger_id: chefBid, typ: "in_pruefung", titel: "Willkommen im Chef-Bereich",
        nachricht: "Hier siehst du alle Buchhaltungen, die zur Prüfung anstehen." },
      { empfaenger_id: benutzerIds["Sekretariat"], typ: "warten_auf_mandant", titel: "Willkommen im Sekretariat",
        nachricht: "Kontaktiere Mandanten, deren Belege noch fehlen." },
    ]);

    return j(200, {
      ok: true,
      users: userIds,
      mandanten: mandantenIds.length,
      buchhaltungen: insertedBh,
    });

  } catch (e) {
    console.error("demo-seed error", e);
    return j(500, { error: (e as Error).message });
  }
});
