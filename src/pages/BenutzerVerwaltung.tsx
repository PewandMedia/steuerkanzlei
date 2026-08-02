import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Pencil, Trash2, UserPlus, ShieldAlert, Mail } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/integrations/supabase/types";
import { usePageMeta } from "@/hooks/use-page-meta";
import { fetchAll as fetchAllRows } from "@/lib/fetch-all";

type Rolle = Database["public"]["Enums"]["benutzer_rolle"];
const ROLLEN: Rolle[] = ["Sekretariat", "Sachbearbeiter", "Chef"];

interface BenutzerRow {
  id: string;
  user_id: string;
  name: string;
  email: string;
  rolle: Rolle | null;
}

export default function BenutzerVerwaltung() {
  usePageMeta("Benutzerverwaltung", "Mitarbeiter, Rollen und Zugriffsrechte verwalten.");

  const { rolle, user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<BenutzerRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [cName, setCName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPassword, setCPassword] = useState("");
  const [cRolle, setCRolle] = useState<Rolle>("Sachbearbeiter");
  const [creating, setCreating] = useState(false);

  // Edit dialog
  const [editRow, setEditRow] = useState<BenutzerRow | null>(null);
  const [eName, setEName] = useState("");
  const [ePassword, setEPassword] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteRow, setDeleteRow] = useState<BenutzerRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function fetchAll() {
    setLoading(true);
    let benutzerRows: any[] = [];
    let roleRows: { user_id: string; role: Rolle }[] = [];
    try {
      [benutzerRows, roleRows] = await Promise.all([
        fetchAllRows<any>((from, to) =>
          supabase
            .from("benutzer")
            .select("id, user_id, name, email")
            .order("name")
            .order("id", { ascending: true })
            .range(from, to) as any,
        ),
        fetchAllRows<{ user_id: string; role: Rolle }>((from, to) =>
          supabase
            .from("user_roles")
            .select("user_id, role")
            .order("user_id", { ascending: true })
            .range(from, to) as any,
        ),
      ]);
    } catch (e: any) {
      toast({ title: "Fehler", description: e?.message ?? String(e), variant: "destructive" });
      setLoading(false);
      return;
    }
    const roleMap = new Map<string, Rolle>();
    roleRows.forEach((r) => roleMap.set(r.user_id, r.role));
    setRows(
      benutzerRows.map((b) => ({
        id: b.id,
        user_id: b.user_id,
        name: b.name,
        email: b.email,
        rolle: roleMap.get(b.user_id) ?? null,
      })),
    );
    setLoading(false);
  }

  useEffect(() => {
    if (rolle === "Chef") fetchAll();
  }, [rolle]);

  if (authLoading) return <div className="p-8 text-muted-foreground">Laden...</div>;

  if (rolle !== "Chef") {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-3">
        <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="text-2xl font-bold">Zugriff verweigert</h1>
        <p className="text-muted-foreground">
          Nur Benutzer mit der Rolle <strong>Chef</strong> dürfen die Benutzerverwaltung öffnen.
        </p>
      </div>
    );
  }

  async function changeRole(row: BenutzerRow, newRole: Rolle) {
    if (row.rolle === newRole) return;
    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole })
      .eq("user_id", row.user_id);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Rolle aktualisiert", description: `${row.name} ist jetzt ${newRole}.` });
    fetchAll();
  }

  function resetCreate() {
    setCName(""); setCEmail(""); setCPassword(""); setCRolle("Sachbearbeiter");
  }

  async function submitCreate() {
    if (!cName.trim() || !cEmail.trim() || cPassword.length < 8) {
      toast({
        title: "Eingaben unvollständig",
        description: "Name, E-Mail und Passwort (min. 8 Zeichen) sind erforderlich.",
        variant: "destructive",
      });
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("benutzer-verwalten", {
      body: { action: "create", name: cName.trim(), email: cEmail.trim(), password: cPassword, rolle: cRolle },
    });
    setCreating(false);
    if (error || (data as any)?.error) {
      toast({
        title: "Fehler",
        description: (data as any)?.error ?? error?.message ?? "Unbekannter Fehler",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Benutzer angelegt", description: `${cName} wurde erstellt.` });
    resetCreate();
    setCreateOpen(false);
    fetchAll();
  }

  function openEdit(row: BenutzerRow) {
    setEditRow(row);
    setEName(row.name);
    setEPassword("");
  }

  async function submitEdit() {
    if (!editRow || !eName.trim()) return;
    if (ePassword && ePassword.length < 8) {
      toast({ title: "Passwort zu kurz", description: "Mindestens 8 Zeichen.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("benutzer")
      .update({ name: eName.trim() })
      .eq("id", editRow.id);
    if (error) {
      setSaving(false);
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    if (ePassword) {
      const { data, error: pwErr } = await supabase.functions.invoke("benutzer-verwalten", {
        body: { action: "set_password", target_user_id: editRow.user_id, password: ePassword },
      });
      if (pwErr || (data as any)?.error) {
        setSaving(false);
        toast({
          title: "Passwort-Fehler",
          description: (data as any)?.error ?? pwErr?.message ?? "Passwort konnte nicht gesetzt werden.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Gespeichert", description: "Name und Passwort aktualisiert." });
    } else {
      toast({ title: "Gespeichert", description: "Name aktualisiert." });
    }
    setSaving(false);
    setEditRow(null);
    fetchAll();
  }

  async function confirmDelete() {
    if (!deleteRow) return;
    setDeleting(true);
    const { data, error } = await supabase.functions.invoke("benutzer-verwalten", {
      body: { action: "delete", target_user_id: deleteRow.user_id },
    });
    setDeleting(false);
    if (error || (data as any)?.error) {
      toast({
        title: "Fehler",
        description: (data as any)?.error ?? error?.message ?? "Unbekannter Fehler",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Benutzer gelöscht", description: `${deleteRow.name} wurde entfernt.` });
    setDeleteRow(null);
    fetchAll();
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 space-y-6 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold">Benutzerverwaltung</h1>
          <p className="text-sm text-muted-foreground">Benutzer anlegen, Rollen vergeben und entfernen.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="w-full sm:w-auto shrink-0">
          <UserPlus className="mr-2 h-4 w-4" /> Neuer Benutzer
        </Button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="card-elevated p-6 text-center text-muted-foreground">Laden…</div>
        ) : rows.length === 0 ? (
          <div className="card-elevated p-6 text-center text-muted-foreground">Keine Benutzer vorhanden.</div>
        ) : (
          rows.map((r) => {
            const isSelf = r.user_id === user?.id;
            return (
              <div
                key={r.id}
                className="card-elevated card-elevated-hover flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5"
              >
                <UserAvatar seed={r.user_id} name={r.name} email={r.email} size="xl" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-foreground truncate">
                      {r.name}
                    </h3>
                    {isSelf && (
                      <Badge variant="outline" className="rounded-full border-brand/30 bg-brand/10 px-2 py-0 text-[10px] font-semibold uppercase tracking-wider text-brand">
                        Du
                      </Badge>
                    )}
                    {r.rolle && (
                      <Badge variant="outline" className="rounded-full px-2 py-0 text-[11px] font-medium">
                        {r.rolle}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground truncate">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{r.email}</span>
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Select
                    value={r.rolle ?? undefined}
                    onValueChange={(v) => changeRole(r, v as Rolle)}
                    disabled={isSelf}
                  >
                    <SelectTrigger className="h-9 w-full sm:w-[170px]">
                      <SelectValue placeholder="Rolle wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLLEN.map((ro) => <SelectItem key={ro} value={ro}>{ro}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" onClick={() => openEdit(r)} title="Bearbeiten">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setDeleteRow(r)}
                      disabled={isSelf}
                      title={isSelf ? "Du kannst dich nicht selbst löschen" : "Löschen"}
                      className="hover:border-destructive/40 hover:bg-destructive/5"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetCreate(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuer Benutzer</DialogTitle>
            <DialogDescription>Lege ein neues Konto an und vergebe eine Rolle.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="z. B. Max Mustermann" />
            </div>
            <div className="space-y-1">
              <Label>E-Mail</Label>
              <Input type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} placeholder="name@firma.de" autoComplete="email" />
            </div>
            <div className="space-y-1">
              <Label>Passwort (min. 8 Zeichen)</Label>
              <Input type="password" value={cPassword} onChange={(e) => setCPassword(e.target.value)} placeholder="Mindestens 8 Zeichen" autoComplete="new-password" />
            </div>
            <div className="space-y-1">
              <Label>Rolle</Label>
              <Select value={cRolle} onValueChange={(v) => setCRolle(v as Rolle)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLLEN.map((ro) => <SelectItem key={ro} value={ro}>{ro}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Abbrechen</Button>
            <Button onClick={submitCreate} disabled={creating}>{creating ? "Lege an..." : "Anlegen"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Benutzer bearbeiten</DialogTitle>
            <DialogDescription>{editRow?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={eName} onChange={(e) => setEName(e.target.value)} placeholder="z. B. Max Mustermann" />
            </div>
            <div className="space-y-1">
              <Label>Neues Passwort</Label>
              <Input
                type="password"
                value={ePassword}
                onChange={(e) => setEPassword(e.target.value)}
                placeholder="Leer lassen, um nicht zu ändern"
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                Mindestens 8 Zeichen. Der Benutzer kann sich danach mit dem neuen Passwort anmelden.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)} disabled={saving}>Abbrechen</Button>
            <Button onClick={submitEdit} disabled={saving}>{saving ? "Speichere..." : "Speichern"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete AlertDialog */}
      <AlertDialog open={!!deleteRow} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Benutzer löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteRow?.name}</strong> ({deleteRow?.email}) wird unwiderruflich entfernt.
              Zugewiesene Mandanten und Buchhaltungen bleiben bestehen, müssen aber ggf. neu zugewiesen werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Lösche..." : "Löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
