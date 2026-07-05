import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as pdfjsLib from "pdfjs-dist";
// Vite-compatible worker import (bundles worker as a separate asset)
// @ts-ignore - ?url is a Vite query suffix
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface Props {
  blobUrl: string | null;
  loading?: boolean;
  fileName?: string;
  onOpenInTab?: () => void;
  onDownload?: () => void;
}

/**
 * PDF Viewer using PDF.js canvas rendering.
 * Bypasses adblocker iframe-blocking (uBlock, Brave, Opera, AdGuard).
 */
export function PdfViewer({ blobUrl, loading, fileName, onOpenInTab, onDownload }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    if (!blobUrl || !containerRef.current) return;

    let cancelled = false;
    let currentPdf: any = null;
    const container = containerRef.current;

    const render = async () => {
      setRenderError(null);
      setIsRendering(true);
      // Clear previous canvases
      container.innerHTML = "";

      try {
        const loadingTask = pdfjsLib.getDocument({ url: blobUrl });
        const pdf = await loadingTask.promise;
        if (cancelled) {
          pdf.destroy();
          return;
        }
        currentPdf = pdf;
        setPageCount(pdf.numPages);

        const MAX_PDF_WIDTH = 1400; // A4-typische Lesebreite in CSS-Pixeln
        const containerWidth = container.clientWidth - 24; // padding
        const targetWidth = Math.min(containerWidth, MAX_PDF_WIDTH);
        const dpr = window.devicePixelRatio || 1;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) break;
          const page = await pdf.getPage(pageNum);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = targetWidth / baseViewport.width;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          canvas.className = "shadow-sm rounded bg-white mx-auto";

          const wrapper = document.createElement("div");
          wrapper.className = "mb-4 flex justify-center";
          wrapper.appendChild(canvas);
          container.appendChild(wrapper);

          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          ctx.scale(dpr, dpr);

          await page.render({ canvasContext: ctx, viewport }).promise;
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error("PDF render error:", err);
          setRenderError(err?.message || "Vorschau konnte nicht gerendert werden");
        }
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    };

    render();

    return () => {
      cancelled = true;
      if (currentPdf) {
        try { currentPdf.destroy(); } catch { /* noop */ }
      }
    };
  }, [blobUrl]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <p>Vorschau nicht verfügbar</p>
      </div>
    );
  }

  if (renderError) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium">PDF-Vorschau nicht möglich</p>
          <p className="text-sm text-muted-foreground mt-1">{renderError}</p>
        </div>
        <div className="flex gap-2">
          {onDownload && (
            <Button size="sm" variant="outline" onClick={onDownload}>
              <Download className="h-4 w-4 mr-1" /> Herunterladen
            </Button>
          )}
          {onOpenInTab && (
            <Button size="sm" variant="outline" onClick={onOpenInTab}>
              <ExternalLink className="h-4 w-4 mr-1" /> In neuem Tab öffnen
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-auto bg-muted/30">
      {isRendering && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2 bg-background/90 backdrop-blur px-2.5 py-1 rounded-md shadow-sm border text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Lade {pageCount > 0 ? `${pageCount} Seiten` : "PDF"}…
        </div>
      )}
      <div ref={containerRef} className="p-3" />
    </div>
  );
}
