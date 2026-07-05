import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Download, Printer, FileText, Loader2, Eye, ChevronLeft, ChevronRight, Image as ImageIcon, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PdfViewer } from "./PdfViewer";
import { isImageFile } from "@/lib/file-types";
import { DokumenteUpload } from "./DokumenteUpload";
import { useAuth } from "@/hooks/use-auth";

interface Dokument {
  id: string;
  dateiname: string;
  dateipfad: string;
  erstellt_am: string;
}

interface Props {
  buchhaltungId: string;
  mandantId?: string;
  mandantName: string;
  monat: string;
  dokumenteCount: number;
  onChanged?: () => void;
}

function triggerDownload(blobUrl: string, dateiname: string) {
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = dateiname;
  a.click();
}

export function BelegeVollansicht({ buchhaltungId, mandantName, monat, dokumenteCount, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const { rolle } = useAuth();
  const canUpload = rolle === "Sekretariat" || rolle === "Sachbearbeiter" || rolle === "Chef";
  const [uploadOpen, setUploadOpen] = useState(false);
  const [dokumente, setDokumente] = useState<Dokument[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewIsImage, setPreviewIsImage] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const currentBlobUrlRef = useRef<string | null>(null);

  const cleanupBlobUrl = () => {
    if (currentBlobUrlRef.current) {
      URL.revokeObjectURL(currentBlobUrlRef.current);
      currentBlobUrlRef.current = null;
    }
  };

  const loadPreview = async (dateipfad: string) => {
    setLoadingPreview(true);
    cleanupBlobUrl();
    setPreviewBlobUrl(null);
    const asImage = isImageFile(dateipfad);
    setPreviewIsImage(asImage);
    try {
      const { data, error } = await supabase.storage.from("belege").createSignedUrl(dateipfad, 300);
      if (error || !data?.signedUrl) throw new Error("Signed URL fehlgeschlagen");
      const res = await fetch(data.signedUrl);
      const blob = await res.blob();
      const finalBlob = asImage
        ? (blob.type.startsWith("image/") ? blob : new Blob([blob], { type: "image/jpeg" }))
        : (blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" }));
      const blobUrl = URL.createObjectURL(finalBlob);
      currentBlobUrlRef.current = blobUrl;
      setPreviewBlobUrl(blobUrl);
    } catch {
      setPreviewBlobUrl(null);
      toast({ title: "Fehler", description: "Vorschau konnte nicht geladen werden.", variant: "destructive" });
    } finally {
      setLoadingPreview(false);
    }
  };

  const fetchDokumente = async () => {
    setLoading(true);
    const docsRes = await supabase
      .from("buchhaltung_dokumente")
      .select("id, dateiname, dateipfad, erstellt_am")
      .eq("buchhaltung_id", buchhaltungId)
      .order("erstellt_am", { ascending: true });
    const data = docsRes.data;
    setDokumente(data ?? []);
    setLoading(false);
    if (data && data.length > 0) {
      setSelectedIndex(0);
      loadPreview(data[0].dateipfad);
    }
  };

  useEffect(() => {
    if (open) {
      fetchDokumente();
      setSelectedIndex(0);
    } else {
      cleanupBlobUrl();
      setPreviewBlobUrl(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, buchhaltungId]);

  useEffect(() => () => cleanupBlobUrl(), []);

  const selectDoc = (index: number) => {
    setSelectedIndex(index);
    if (dokumente[index]) loadPreview(dokumente[index].dateipfad);
  };

  const handleDownload = (dateiname: string) => {
    if (!previewBlobUrl) return;
    triggerDownload(previewBlobUrl, dateiname);
  };

  const handlePrint = () => {
    if (!previewBlobUrl) {
      toast({ title: "Fehler", description: "Vorschau nicht bereit.", variant: "destructive" });
      return;
    }
    if (previewIsImage) {
      const win = window.open("", "_blank");
      if (!win) {
        toast({ title: "Drucken nicht möglich", description: "Popup-Blocker verhindert das Drucken.", variant: "destructive" });
        return;
      }
      win.document.write(`<html><head><title>Drucken</title></head><body style="margin:0"><img src="${previewBlobUrl}" style="max-width:100%" onload="window.focus();window.print();" /></body></html>`);
      win.document.close();
      return;
    }
    try {
      const printFrame = document.createElement("iframe");
      printFrame.style.position = "fixed";
      printFrame.style.right = "0";
      printFrame.style.bottom = "0";
      printFrame.style.width = "0";
      printFrame.style.height = "0";
      printFrame.style.border = "0";
      printFrame.src = previewBlobUrl;
      printFrame.onload = () => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
          setTimeout(() => printFrame.remove(), 60_000);
        } catch {
          printFrame.remove();
          toast({ title: "Drucken nicht möglich", description: "Bitte Beleg herunterladen und manuell drucken.", variant: "destructive" });
        }
      };
      document.body.appendChild(printFrame);
    } catch {
      toast({ title: "Drucken nicht möglich", description: "Bitte Beleg herunterladen und manuell drucken.", variant: "destructive" });
    }
  };

  const handleDownloadAll = async () => {
    for (const dok of dokumente) {
      const { data, error } = await supabase.storage.from("belege").createSignedUrl(dok.dateipfad, 60);
      if (error || !data?.signedUrl) continue;
      try {
        const res = await fetch(data.signedUrl);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        triggerDownload(url, dok.dateiname);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch {
        // skip
      }
    }
  };

  if (dokumenteCount === 0) {
    if (!canUpload) {
      return <span className="text-xs text-muted-foreground">Keine Belege</span>;
    }
    return (
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setUploadOpen(true); }}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Upload className="h-4 w-4" />
            <span>Belege hochladen</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Belege hochladen — {mandantName} ({monat})</DialogTitle>
          </DialogHeader>
          <DokumenteUpload
            buchhaltungId={buchhaltungId}
            onUploaded={() => { setOpen(false); onChanged?.(); }}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Eye className="h-4 w-4" />
          <span>{dokumenteCount} Beleg{dokumenteCount !== 1 ? "e" : ""} ansehen</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[92vh] flex flex-col p-0 gap-0 sm:max-w-[1400px]">
        <DialogHeader className="px-6 py-3 border-b">
          <DialogTitle className="flex items-center justify-between gap-2 flex-wrap pr-8">
            <span>Belege — {mandantName} ({monat})</span>
            <div className="flex gap-2">
              {canUpload && (
                <Button
                  variant={uploadOpen ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUploadOpen((v) => !v)}
                  title="Nachgereichte Belege hinzufügen"
                >
                  {uploadOpen ? <X className="h-4 w-4 mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                  {uploadOpen ? "Schließen" : "Belege nachreichen"}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handlePrint} disabled={!previewBlobUrl}>
                <Printer className="h-4 w-4 mr-1" /> Drucken
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadAll}>
                <Download className="h-4 w-4 mr-1" /> Alle herunterladen
              </Button>
            </div>
          </DialogTitle>
          {uploadOpen && canUpload && (
            <div className="pt-3 mt-2 border-t">
              <p className="text-xs text-muted-foreground mb-2">
                Nachgereichte Belege vom Mandanten — werden direkt zu dieser Buchhaltung hinzugefügt. Der zuständige Sachbearbeiter wird automatisch benachrichtigt.
              </p>
              <DokumenteUpload
                buchhaltungId={buchhaltungId}
                onUploaded={() => { fetchDokumente(); setUploadOpen(false); onChanged?.(); }}
              />
            </div>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 grid min-h-0" style={{ gridTemplateColumns: "220px 1fr" }}>
            {/* Left: Beleg-Liste */}
            <div className="space-y-1 overflow-y-auto border-r p-3">
              {dokumente.map((dok, i) => {
                const docIsImage = isImageFile(dok.dateiname);
                return (
                  <button
                    key={dok.id}
                    onClick={() => selectDoc(i)}
                    className={cn(
                      "w-full text-left p-2.5 rounded-md text-sm transition-colors",
                      i === selectedIndex
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted text-foreground",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {docIsImage ? (
                        <ImageIcon className="h-4 w-4 shrink-0" />
                      ) : (
                        <FileText className="h-4 w-4 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{dok.dateiname}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(dok.erstellt_am).toLocaleDateString("de-DE")}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right: PDF-Vorschau */}
            <div className="flex flex-col min-h-0 p-3">
              {dokumente.length > 1 && (
                <div className="flex items-center justify-between mb-2">
                  <Button variant="ghost" size="sm" disabled={selectedIndex === 0} onClick={() => selectDoc(selectedIndex - 1)}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Vorheriger
                  </Button>
                  <span className="text-sm text-muted-foreground">{selectedIndex + 1} von {dokumente.length}</span>
                  <Button variant="ghost" size="sm" disabled={selectedIndex === dokumente.length - 1} onClick={() => selectDoc(selectedIndex + 1)}>
                    Nächster <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}

              <div className="flex-1 rounded-lg border overflow-hidden min-h-0">
                {previewIsImage ? (
                  <div className="w-full h-full flex items-center justify-center bg-muted/30 overflow-auto">
                    {loadingPreview ? (
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    ) : previewBlobUrl ? (
                      <img
                        src={previewBlobUrl}
                        alt={dokumente[selectedIndex]?.dateiname ?? "Beleg"}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">Vorschau nicht verfügbar</p>
                    )}
                  </div>
                ) : (
                  <PdfViewer
                    blobUrl={previewBlobUrl}
                    loading={loadingPreview}
                    fileName={dokumente[selectedIndex]?.dateiname}
                    onDownload={() => dokumente[selectedIndex] && handleDownload(dokumente[selectedIndex].dateiname)}
                  />
                )}
              </div>

              {dokumente[selectedIndex] && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => handleDownload(dokumente[selectedIndex].dateiname)} disabled={!previewBlobUrl}>
                    <Download className="h-4 w-4 mr-1" /> Herunterladen
                  </Button>
                  <Button variant="outline" size="sm" onClick={handlePrint} disabled={!previewBlobUrl}>
                    <Printer className="h-4 w-4 mr-1" /> Drucken
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
