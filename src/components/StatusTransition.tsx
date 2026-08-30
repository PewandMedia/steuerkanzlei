import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { Check, X, Play, Send, RotateCcw, CheckCircle, ChevronDown, Undo2, Inbox } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type BuchhaltungStatus = Database["public"]["Enums"]["buchhaltung_status"];
type BenutzerRolle = Database["public"]["Enums"]["benutzer_rolle"];

interface Props {
  buchhaltungId: string;
  currentStatus: BuchhaltungStatus;
  rolle: BenutzerRolle;
  onStatusChanged: () => void;
  /** When true, the "Vollständig → In Prüfung" action is disabled with a tooltip */
  disablePruefung?: boolean;
  disablePruefungReason?: string;
}

const ALLE_STATUS: BuchhaltungStatus[] = [
  "Eingegangen",
  "In Bearbeitung",
  "Warten auf Mandant",
  "In Prüfung",
  "Buchhaltung erledigt",
];

export function StatusTransition({ buchhaltungId, currentStatus, rolle, onStatusChanged, disablePruefung, disablePruefungReason }: Props) {
  const [loading, setLoading] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ status: BuchhaltungStatus; requireNote: boolean; titel?: string } | null>(null);
  const [note, setNote] = useState("");

  const handleTransition = async (newStatus: BuchhaltungStatus, notiz?: string) => {
    setLoading(true);
    const updateData: Record<string, unknown> = { status: newStatus };
    const erledigtZeitpunkt = new Date().toISOString();

    if (notiz) {
      updateData.notizen = notiz;
    }
    if (newStatus === "Buchhaltung erledigt") {
      updateData.fertiggestellt_datum = erledigtZeitpunkt.split("T")[0];
    }

    const { error } = await supabase
      .from("buchhaltungen")
      .update(updateData as any)
      .eq("id", buchhaltungId);

    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Status geändert", description: `Neuer Status: ${newStatus}` });
      onStatusChanged();
    }

    setLoading(false);
    setShowNoteDialog(false);
    setNote("");
    setPendingAction(null);
  };

  const openNoteDialog = (status: BuchhaltungStatus, requireNote: boolean, titel?: string) => {
    setPendingAction({ status, requireNote, titel });
    setNote("");
    setShowNoteDialog(true);
  };

  const submitWithNote = () => {
    if (!pendingAction) return;
    if (pendingAction.requireNote && !note.trim()) {
      toast({ title: "Notiz erforderlich", description: "Bitte angeben, was genau fehlt.", variant: "destructive" });
      return;
    }
    handleTransition(pendingAction.status, note.trim() || undefined);
  };

  // Render context-specific quick action buttons (Workflow-Standardpfad)
  const renderActions = () => {
    if (currentStatus === "Eingegangen" && rolle === "Sachbearbeiter") {
      return (
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white"
          disabled={loading}
          onClick={() => handleTransition("In Bearbeitung")}
        >
          <Play className="h-3.5 w-3.5 mr-1" />
          Annehmen
        </Button>
      );
    }

    if (currentStatus === "In Bearbeitung" && rolle === "Sachbearbeiter") {
      const pruefungBtn = (
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
          disabled={loading || disablePruefung}
          onClick={() => handleTransition("In Prüfung")}
        >
          <Send className="h-3.5 w-3.5 mr-1" />
          Zur Prüfung senden
        </Button>
      );
      return (
        <div className="flex gap-1.5">
          {disablePruefung && disablePruefungReason ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild><span tabIndex={0}>{pruefungBtn}</span></TooltipTrigger>
                <TooltipContent><p className="text-xs">{disablePruefungReason}</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : pruefungBtn}
          <Button
            size="sm"
            variant="destructive"
            disabled={loading}
            onClick={() => openNoteDialog("Warten auf Mandant", true)}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Unvollständig
          </Button>
        </div>
      );
    }

    if (currentStatus === "Warten auf Mandant" && rolle === "Sachbearbeiter") {
      return (
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white"
          disabled={loading}
          onClick={() => handleTransition("In Bearbeitung")}
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1" />
          Weiterarbeiten
        </Button>
      );
    }

    if (currentStatus === "In Prüfung" && rolle === "Chef") {
      return (
        <div className="flex gap-1.5">
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={loading}
            onClick={() => handleTransition("Buchhaltung erledigt")}
          >
            <CheckCircle className="h-3.5 w-3.5 mr-1" />
            Freigeben
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={loading}
            onClick={() => openNoteDialog("In Bearbeitung", false, "Zurück an Sachbearbeiter")}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Zurückweisen
          </Button>
        </div>
      );
    }

    return null;
  };

  // "Status ändern" Dropdown — Sachbearbeiter & Chef können Status frei setzen
  const renderStatusDropdown = () => {
    if (rolle !== "Chef" && rolle !== "Sachbearbeiter") return null;
    const istChef = rolle === "Chef";

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button data-tour="status-dropdown" size="sm" variant="ghost" disabled={loading} className="h-8 px-2 text-muted-foreground">
            Status <ChevronDown className="h-3.5 w-3.5 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="text-xs">Status setzen auf…</DropdownMenuLabel>
          {ALLE_STATUS.map((s) => (
            <DropdownMenuItem
              key={s}
              disabled={s === currentStatus || loading}
              onClick={() => {
                if (s === currentStatus) return;
                if (s === "Warten auf Mandant") {
                  openNoteDialog(s, true);
                  return;
                }
                handleTransition(s);
              }}
            >
              {s === currentStatus ? (
                <Check className="h-3.5 w-3.5 mr-2" />
              ) : (
                <span className="w-3.5 mr-2 inline-block" />
              )}
              <span>{s}</span>
            </DropdownMenuItem>
          ))}

          {istChef && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs">Chef-Aktionen</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => openNoteDialog("In Bearbeitung", false, "Zurück an Sachbearbeiter")}
                disabled={currentStatus === "In Bearbeitung"}
              >
                <Undo2 className="h-3.5 w-3.5 mr-2" /> Zurück an Sachbearbeiter
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => openNoteDialog("Warten auf Mandant", true, "Ablehnen → Mandant kontaktieren")}
                disabled={currentStatus === "Warten auf Mandant"}
                className="text-destructive focus:text-destructive"
              >
                <X className="h-3.5 w-3.5 mr-2" /> Ablehnen → Mandant
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleTransition("Eingegangen")}
                disabled={currentStatus === "Eingegangen"}
              >
                <Inbox className="h-3.5 w-3.5 mr-2" /> Auf „Eingegangen" zurücksetzen
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <>
      <div className="flex items-center gap-1">
        {renderActions()}
        {renderStatusDropdown()}
      </div>

      <Dialog open={showNoteDialog} onOpenChange={(v) => { if (!loading) { setShowNoteDialog(v); if (!v) { setNote(""); setPendingAction(null); } } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.titel
                ? pendingAction.titel
                : pendingAction?.status === "Warten auf Mandant"
                ? "Was fehlt noch?"
                : "Grund der Zurückweisung"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-sm">
              {pendingAction?.requireNote ? "Notiz (Pflichtfeld)" : "Notiz (optional)"}
            </Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                pendingAction?.status === "Warten auf Mandant"
                  ? "z.B. Kontoauszüge Februar fehlen, Rechnungen Nr. 1234 nicht lesbar…"
                  : "z.B. Fehler in der Umsatzsteuer-Berechnung…"
              }
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNoteDialog(false); setNote(""); setPendingAction(null); }} disabled={loading}>
              Abbrechen
            </Button>
            <Button
              onClick={submitWithNote}
              disabled={loading || (pendingAction?.requireNote && !note.trim())}
              variant={pendingAction?.status === "Warten auf Mandant" ? "destructive" : "default"}
            >
              {loading ? "Wird gespeichert…" : "Bestätigen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
