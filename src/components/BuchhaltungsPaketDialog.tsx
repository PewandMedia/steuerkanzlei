import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileSpreadsheet, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { BuchhaltungsPaket } from "./BuchhaltungsPaket";
import { useBuchungsFortschritt } from "@/hooks/use-buchungs-fortschritt";
import type { Database } from "@/integrations/supabase/types";

type BuchhaltungStatus = Database["public"]["Enums"]["buchhaltung_status"];

interface Props {
  buchhaltungId: string;
  status: BuchhaltungStatus;
  monat: string;
  mandantName: string;
  hatAbschluss: boolean;
  onChanged?: () => void;
}

export function BuchhaltungsPaketDialog({
  buchhaltungId,
  status,
  monat,
  mandantName,
  hatAbschluss,
  onChanged,
}: Props) {
  const [open, setOpen] = useState(false);
  const { allBooked, total } = useBuchungsFortschritt(buchhaltungId);

  // Button only appears once all receipts are booked, OR the package is already closed
  const sichtbar = hatAbschluss || (allBooked && total > 0);
  if (!sichtbar) return null;

  const label = hatAbschluss ? "Paket öffnen" : "Buchhaltungs-Paket";
  const Icon = hatAbschluss ? Package : FileSpreadsheet;
  const tooltip = hatAbschluss
    ? "Buchhaltungs-Paket ansehen und herunterladen"
    : "Alle Belege gebucht – Buchhaltung jetzt prüfen, downloaden und einreichen";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "gap-1.5 w-full justify-start",
                  hatAbschluss
                    ? "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10"
                    : "border-green-300 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200 dark:hover:bg-green-900"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate">{label}</span>
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="max-w-[1100px] w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Buchhaltungs-Paket — {mandantName} ({monat})
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <BuchhaltungsPaket
            buchhaltungId={buchhaltungId}
            status={status}
            monat={monat}
            mandantName={mandantName}
            onChanged={onChanged}
          />
        </div>

        <DialogFooter className="px-6 py-3 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
