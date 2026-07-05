import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DokumenteUpload } from "@/components/DokumenteUpload";
import { DokumenteListe } from "@/components/DokumenteListe";
import { Paperclip } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface Props {
  buchhaltungId: string;
  mandantName: string;
  monat: string;
  dokumenteCount: number;
  canUpload: boolean;
}

export function BelegeDialog({ buchhaltungId, mandantName, monat, dokumenteCount, canUpload }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Paperclip className="h-4 w-4" />
          <span>{dokumenteCount}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Belege — {mandantName} ({monat})</DialogTitle>
        </DialogHeader>

        {canUpload && (
          <>
            <DokumenteUpload
              buchhaltungId={buchhaltungId}
              onUploaded={() => setRefreshKey((k) => k + 1)}
            />
            <Separator />
          </>
        )}

        <DokumenteListe buchhaltungId={buchhaltungId} refreshKey={refreshKey} />
      </DialogContent>
    </Dialog>
  );
}
