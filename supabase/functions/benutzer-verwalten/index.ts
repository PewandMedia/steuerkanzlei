import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CreateSchema = z.object({
  action: z.literal("create"),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(200),
  rolle: z.enum(["Sekretariat", "Sachbearbeiter", "Chef"]),
});

const DeleteSchema = z.object({
  action: z.literal("delete"),
  target_user_id: z.string().uuid(),
});

const SetPasswordSchema = z.object({
  action: z.literal("set_password"),
  target_user_id: z.string().uuid(),
  password: z.string().min(8).max(200),
});

const BodySchema = z.discriminatedUnion("action", [CreateSchema, DeleteSchema, SetPasswordSchema]);

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const service = createClient(SUPABASE_URL, SERVICE_KEY);

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json(401, { error: "Unauthorized" });
    const callerId = claimsData.claims.sub as string;

    // Check Chef role
    const { data: isChef, error: chefErr } = await service.rpc("has_role", {
      _user_id: callerId,
      _role: "Chef",
    });
    if (chefErr || !isChef) return json(403, { error: "Nur Chef darf Benutzer verwalten." });

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return json(400, { error: "Ungültige Eingabe", details: parsed.error.flatten() });
    }
    const body = parsed.data;

    if (body.action === "create") {
      const { data: created, error: createErr } = await service.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: { name: body.name },
      });
      if (createErr || !created.user) {
        return json(400, { error: createErr?.message ?? "Konnte Benutzer nicht anlegen" });
      }

      // Trigger handle_new_user sets default role 'Sachbearbeiter' — update if needed
      if (body.rolle !== "Sachbearbeiter") {
        const { error: roleErr } = await service
          .from("user_roles")
          .update({ role: body.rolle })
          .eq("user_id", created.user.id);
        if (roleErr) {
          return json(500, { error: `Rolle konnte nicht gesetzt werden: ${roleErr.message}` });
        }
      }
      return json(200, { ok: true, user_id: created.user.id });
    }

    if (body.action === "set_password") {
      const { error: pwErr } = await service.auth.admin.updateUserById(body.target_user_id, {
        password: body.password,
      });
      if (pwErr) return json(400, { error: pwErr.message });
      return json(200, { ok: true });
    }

    // delete
    if (body.target_user_id === callerId) {
      return json(403, { error: "Du kannst dich nicht selbst löschen." });
    }
    const { error: delErr } = await service.auth.admin.deleteUser(body.target_user_id);
    if (delErr) return json(400, { error: delErr.message });
    return json(200, { ok: true });
  } catch (e) {
    console.error("benutzer-verwalten error", e);
    return json(500, { error: (e as Error).message ?? "Interner Fehler" });
  }
});
