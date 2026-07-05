import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Mail, Phone, MessageSquare } from "lucide-react";
import { WhatsAppButton } from "@/components/WhatsAppButton";

interface MandantKontaktDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buchhaltungId: string;
  mandantName: string;
  telefon: string | null;
  email: string | null;
  bestehendeNotiz: string | null;
  onSaved: () => void;
}

export function MandantKontaktDialog({
  open,
  onOpenChange,
  buchhaltungId,
  mandantName,
  telefon,
  email,
  bestehendeNotiz,
  onSaved,
}: MandantKontaktDialogProps) {
  const [kontaktNotiz, setKontaktNotiz] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!kontaktNotiz.trim()) {
      toast({ title: "Bitte eine Kontakt-Notiz eingeben", variant: "destructive" });
      return;
    }
    setSaving(true);
    const datum = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
    const prefix = `[${datum} Sekretariat] `;
    const neueNotiz = bestehendeNotiz
      ? `${bestehendeNotiz}\n${prefix}${kontaktNotiz.trim()}`
      : `${prefix}${kontaktNotiz.trim()}`;

    const { error } = await supabase
      .from("buchhaltungen")
      .update({ notizen: neueNotiz })
      .eq("id", buchhaltungId);

    setSaving(false);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Kontakt-Notiz gespeichert" });
    setKontaktNotiz("");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mandant kontaktieren: {mandantName}</DialogTitle>
          <DialogDescription>
            Kontaktiere den Mandanten und dokumentiere das Ergebnis als Notiz.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {bestehendeNotiz && (
            <div className="rounded-md border border-border bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> Was fehlt / Bisherige Notizen
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{bestehendeNotiz}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2">
            {telefon ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <a
                  href={`tel:${telefon}`}
                  className="flex items-center gap-2 hover:underline flex-1"
                >
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">{telefon}</span>
                </a>
                <WhatsAppButton telefon={telefon} mandantName={mandantName} />
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground italic">
                <Phone className="h-4 w-4" /> Keine Telefonnummer hinterlegt
              </div>
            )}
            {email ? (
              <a
                href={`mailto:${email}?subject=${encodeURIComponent(`Buchhaltung - ${mandantName}`)}`}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent transition-colors"
              >
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{email}</span>
              </a>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground italic">
                <Mail className="h-4 w-4" /> Keine E-Mail hinterlegt
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="kontakt-notiz" className="text-xs">Kontakt-Notiz</Label>
            <Textarea
              id="kontakt-notiz"
              placeholder="z.B. Mandant per Telefon erreicht, schickt Belege bis Freitag"
              value={kontaktNotiz}
              onChange={(e) => setKontaktNotiz(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Speichern..." : "Notiz speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
