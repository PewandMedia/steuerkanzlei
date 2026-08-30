import { Briefcase, Crown, Phone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getStatusColor } from "@/lib/buchhaltung-workflow";
import type { Database } from "@/integrations/supabase/types";

type BenutzerRolle = Database["public"]["Enums"]["benutzer_rolle"];

interface TutorialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rolle: BenutzerRolle | null;
  onStartTour: () => void;
}

const rollen: { rolle: BenutzerRolle; titel: string; person: string; icon: typeof Phone; text: string }[] = [
  {
    rolle: "Sekretariat",
    titel: "Sekretariat",
    person: "Sabine",
    icon: Phone,
    text: "Nimmt Belege an, legt Buchhaltungen an, kontaktiert Mandanten. Ändert selbst keinen Status.",
  },
  {
    rolle: "Sachbearbeiter",
    titel: "Sachbearbeiter",
    person: "Simon",
    icon: Briefcase,
    text: "Bearbeitet die Buchhaltung, fordert Fehlendes an, gibt zur Prüfung.",
  },
  {
    rolle: "Chef",
    titel: "Chef / Steuerberater",
    person: "Christina",
    icon: Crown,
    text: "Prüft, gibt frei oder weist zurück.",
  },
];

const pipeline: Database["public"]["Enums"]["buchhaltung_status"][] = [
  "Eingegangen",
  "In Bearbeitung",
  "In Prüfung",
  "Buchhaltung erledigt",
];

const uebergaenge: { text: string }[] = [
  { text: "Sachbearbeiter · Button „Annehmen\u201c" },
  { text: "Sachbearbeiter · Button „Zur Prüfung senden\u201c" },
  { text: "Chef · Button „Freigeben\u201c" },
];

export function TutorialDialog({ open, onOpenChange, rolle, onStartTour }: TutorialDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>So funktioniert das Kanzlei-Backoffice</DialogTitle>
          <DialogDescription>
            Drei Rollen arbeiten an derselben Buchhaltung — jede sieht nur, was sie braucht.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          {rollen.map((r) => {
            const aktiv = r.rolle === rolle;
            const Icon = r.icon;
            return (
              <div
                key={r.rolle}
                className={`rounded-lg border p-3 ${
                  aktiv ? "border-brand bg-brand/5" : "border-border bg-card"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-brand" />
                  <p className="text-sm font-semibold text-foreground">{r.titel}</p>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{r.person}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{r.text}</p>
                {aktiv && (
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-brand">
                    Ihre Rolle
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-2">
          <p className="section-label mb-2 text-xs uppercase tracking-wider text-muted-foreground">
            Die Status-Pipeline
          </p>
          <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
            {pipeline.map((status, i) => (
              <div key={status} className="flex flex-col gap-2 md:flex-row md:items-center">
                <span
                  className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusColor(status)}`}
                >
                  {status}
                </span>
                {i < uebergaenge.length && (
                  <div className="md:mx-1 md:max-w-[110px]">
                    <p className="text-[10px] leading-tight text-muted-foreground">
                      <span className="md:hidden">↓ </span>
                      <span className="hidden md:inline">→ </span>
                      {uebergaenge[i].text}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-lg border border-dashed border-border p-3">
            <span
              className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusColor("Warten auf Mandant")}`}
            >
              Warten auf Mandant
            </span>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Seitenast von „In Bearbeitung\u201c: Sachbearbeiter · Button „Unvollständig\u201c (Notiz ist
              Pflichtfeld). Zurück mit Sachbearbeiter · Button „Weiterarbeiten\u201c.
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Aus „In Prüfung\u201c zurück nach „In Bearbeitung\u201c: Chef · Button „Zurückweisen\u201c.
            </p>
          </div>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          Demo-Daten werden jede Nacht automatisch zurückgesetzt — Sie können nichts kaputt machen.
        </p>

        <DialogFooter className="mt-2 gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
          <Button onClick={onStartTour}>Tour starten</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TutorialDialog;
