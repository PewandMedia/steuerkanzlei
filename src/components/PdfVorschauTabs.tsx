import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PdfViewer } from "@/components/PdfViewer";
import { Check, FileText, Receipt, Package, FileSpreadsheet, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PdfVorschauItem {
  key: string;
  label: string;
  pfad: string | null;
  icon: "paket" | "ustva" | "susa" | "journal";
}

interface Props {
  items: PdfVorschauItem[];
  geprueft: Set<string>;
  onGeprueft: (key: string) => void;
}

const ICONS = {
  paket: Package,
  ustva: Receipt,
  susa: FileSpreadsheet,
  journal: FileText,
};

export function PdfVorschauTabs({ items, geprueft, onGeprueft }: Props) {
  const first = items[0]?.key ?? "";
  const [active, setActive] = useState(first);
  const [blobUrls, setBlobUrls] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const cacheRef = useRef<Record<string, string>>({});

  // Mark first tab as inspected on mount
  useEffect(() => {
    if (first) onGeprueft(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load PDF for active tab on demand
  useEffect(() => {
    const item = items.find((i) => i.key === active);
    if (!item || !item.pfad) return;
    if (cacheRef.current[item.key]) {
      setBlobUrls((prev) => ({ ...prev, [item.key]: cacheRef.current[item.key] }));
      return;
    }
    let cancelled = false;
    setLoading((prev) => ({ ...prev, [item.key]: true }));
    (async () => {
      try {
        const { data, error } = await supabase.storage
          .from("buchhaltungen")
          .createSignedUrl(item.pfad!, 60);
        if (error || !data?.signedUrl) throw error ?? new Error("Keine URL");
        const res = await fetch(data.signedUrl);
        const blob = await res.blob();
        const pdfBlob = blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });
        const url = URL.createObjectURL(pdfBlob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        cacheRef.current[item.key] = url;
        setBlobUrls((prev) => ({ ...prev, [item.key]: url }));
      } catch {
        if (!cancelled) setBlobUrls((prev) => ({ ...prev, [item.key]: null }));
      } finally {
        if (!cancelled) setLoading((prev) => ({ ...prev, [item.key]: false }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, items]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(cacheRef.current).forEach((url) => URL.revokeObjectURL(url));
      cacheRef.current = {};
    };
  }, []);

  const handleChange = (val: string) => {
    setActive(val);
    onGeprueft(val);
  };

  const allChecked = items.every((i) => geprueft.has(i.key));

  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-foreground">
            Letzte Prüfung vor ELSTER-Übermittlung
          </p>
          <p className="text-xs text-muted-foreground">
            Bitte alle vier PDFs durchsehen — so wie sie an das Finanzamt übergeben werden.
            Erst danach kann die Freigabe erteilt werden.
          </p>
        </div>
      </div>

      <Tabs value={active} onValueChange={handleChange}>
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted p-1">
          {items.map((item) => {
            const Icon = ICONS[item.icon];
            const checked = geprueft.has(item.key);
            return (
              <TabsTrigger
                key={item.key}
                value={item.key}
                className="gap-1.5 data-[state=active]:bg-background"
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
                {checked && (
                  <Check className="h-3.5 w-3.5 text-green-600" aria-label="geprüft" />
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {items.map((item) => (
          <TabsContent key={item.key} value={item.key} className="mt-3">
            <div className="rounded-md border bg-background overflow-hidden h-[85vh] min-h-[700px]">
              <PdfViewer
                blobUrl={blobUrls[item.key] ?? null}
                loading={loading[item.key]}
                fileName={item.label}
              />
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <div className="flex items-center gap-2 text-xs">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
            allChecked
              ? "bg-green-600/10 text-green-700 dark:text-green-500"
              : "bg-muted text-muted-foreground",
          )}
        >
          {allChecked ? <Check className="h-3 w-3" /> : null}
          {geprueft.size}/{items.length} PDFs angesehen
        </span>
        {!allChecked && (
          <span className="text-muted-foreground">
            Klicken Sie alle Tabs an, um sie zu prüfen.
          </span>
        )}
      </div>
    </div>
  );
}