import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fetchAll } from "@/lib/fetch-all";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Download, Trash2, FileText, Loader2, ExternalLink, Image as ImageIcon } from "lucide-react";
import { isImageFile, isPdfFile } from "@/lib/file-types";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Dokument {
  id: string;
  dateiname: string;
  dateipfad: string;
  erstellt_am: string;
  uploader_name: string | null;
}

interface Props {
  buchhaltungId: string;
  refreshKey?: number;
}

async function blobDownload(signedUrl: string, dateiname: string) {
  try {
    const res = await fetch(signedUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = dateiname;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    toast({ title: "Fehler", description: "Download fehlgeschlagen.", variant: "destructive" });
  }
}

export function DokumenteListe({ buchhaltungId, refreshKey }: Props) {
  const { rolle } = useAuth();
  const [dokumente, setDokumente] = useState<Dokument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDokumente = async () => {
    setLoading(true);
    let data: any[] = [];
    try {
      data = await fetchAll<any>((from, to) =>
        supabase
          .from("buchhaltung_dokumente")
          .select("id, dateiname, dateipfad, erstellt_am, uploader:benutzer!buchhaltung_dokumente_hochgeladen_von_fkey(name)")
          .eq("buchhaltung_id", buchhaltungId)
          .order("erstellt_am", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to) as any,
      );
    } catch {
      data = [];
    }

    setDokumente(
      data.map((d: any) => ({
        id: d.id,
        dateiname: d.dateiname,
        dateipfad: d.dateipfad,
        erstellt_am: d.erstellt_am,
        uploader_name: d.uploader?.name ?? null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchDokumente(); }, [buchhaltungId, refreshKey]);

  const handleDownload = async (dateipfad: string, dateiname: string) => {
    const { data, error } = await supabase.storage.from("belege").createSignedUrl(dateipfad, 60);
    if (error || !data?.signedUrl) {
      toast({ title: "Fehler", description: "Download-Link konnte nicht erstellt werden.", variant: "destructive" });
      return;
    }
    await blobDownload(data.signedUrl, dateiname);
  };

  const handleOpenInTab = async (dateipfad: string) => {
    // Synchron einen leeren Tab öffnen, damit der Popup-Blocker nicht greift
    const newWindow = window.open("", "_blank");
    const { data, error } = await supabase.storage.from("belege").createSignedUrl(dateipfad, 300);
    if (error || !data?.signedUrl) {
      newWindow?.close();
      toast({ title: "Fehler", description: "Link konnte nicht erstellt werden.", variant: "destructive" });
      return;
    }
    // Für Bilder direkt die signed URL öffnen — kein PDF-Force
    if (isImageFile(dateipfad)) {
      if (newWindow) newWindow.location.href = data.signedUrl;
      else window.open(data.signedUrl, "_blank");
      return;
    }
    try {
      const res = await fetch(data.signedUrl);
      const blob = await res.blob();
      const pdfBlob = blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(pdfBlob);
      if (newWindow) {
        newWindow.location.href = blobUrl;
      } else {
        window.open(blobUrl, "_blank");
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch {
      if (newWindow) newWindow.location.href = data.signedUrl;
      else window.open(data.signedUrl, "_blank");
    }
  };

  const handleDelete = async (id: string, dateipfad: string) => {
    await supabase.storage.from("belege").remove([dateipfad]);
    const { error } = await supabase.from("buchhaltung_dokumente").delete().eq("id", id);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Dokument gelöscht" });
      fetchDokumente();
    }
  };

  const canDelete = rolle === "Sekretariat" || rolle === "Chef";

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (dokumente.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Noch keine Belege hochgeladen</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {dokumente.map((dok) => (
        <div key={dok.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
          {isImageFile(dok.dateiname) ? (
            <ImageIcon className="h-5 w-5 text-primary shrink-0" />
          ) : (
            <FileText className="h-5 w-5 text-primary shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{dok.dateiname}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(dok.erstellt_am).toLocaleDateString("de-DE")}
              {dok.uploader_name && ` · ${dok.uploader_name}`}
            </p>
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={() => handleOpenInTab(dok.dateipfad)} title="In neuem Tab öffnen">
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => handleDownload(dok.dateipfad, dok.dateiname)} title="Herunterladen">
              <Download className="h-4 w-4" />
            </Button>
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Dokument löschen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      „{dok.dateiname}" wird unwiderruflich gelöscht.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(dok.id, dok.dateipfad)}>
                      Löschen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
