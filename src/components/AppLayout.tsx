import { useState } from "react";
import { GraduationCap, PlayCircle, X } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ZurueckweisungAlert } from "@/components/ZurueckweisungAlert";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { useTutorial } from "@/hooks/use-tutorial";

function TutorialControls() {
  const { lauf, aktiv, gesehen, rolleStimmt, starten, schliessen, verwerfen } = useTutorial();
  const [hinweis, setHinweis] = useState<string | null>(null);

  const start = () => {
    const problem = starten();
    setHinweis(problem);
  };

  const fortsetzenBanner = !aktiv && lauf && rolleStimmt;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={start}
        aria-label={lauf ? "Tutorial fortsetzen" : "Tutorial starten"}
        className="relative ml-auto h-9 rounded-full"
      >
        <GraduationCap className="h-4 w-4 sm:mr-1.5" />
        <span className="hidden sm:inline">{lauf ? "Tutorial fortsetzen" : "Tutorial"}</span>
        {(!gesehen || !!lauf) && (
          <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
          </span>
        )}
      </Button>

      {hinweis && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl">
            <h3 className="text-base font-semibold text-foreground">Rolle wechseln</h3>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{hinweis}</p>
            <div className="flex gap-2 mt-5">
              <Button onClick={() => setHinweis(null)}>Verstanden</Button>
              <Button
                variant="ghost"
                onClick={() => {
                  verwerfen();
                  setHinweis(null);
                }}
              >
                Lauf verwerfen
              </Button>
            </div>
          </div>
        </div>
      )}

      {fortsetzenBanner && (
        <div className="fixed bottom-4 left-1/2 z-[90] -translate-x-1/2 flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 shadow-lg">
          <PlayCircle className="h-4 w-4 text-brand shrink-0" />
          <span className="text-xs text-foreground">Tutorial-Lauf offen — hier weitermachen?</span>
          <Button size="sm" className="h-7 text-xs" onClick={start}>
            Fortsetzen
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={verwerfen}
            aria-label="Tutorial-Lauf verwerfen"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {aktiv && lauf && <TutorialOverlay lauf={lauf} onBeenden={schliessen} />}
    </>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  // Sidebar ab 1280 px standardmäßig offen — passt zu typischen Desktop-Auflösungen.
  // Auf kleineren Laptops (<1280 px) bleibt sie kollabiert, damit Tabellen Platz haben.
  const defaultOpen =
    typeof window === "undefined" ? true : window.innerWidth >= 1280;
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <div className="min-h-screen flex w-full overflow-x-hidden bg-transparent">
        <AppSidebar />
        <ZurueckweisungAlert />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 h-16 flex items-center gap-3 border-b border-border/60 bg-card/80 backdrop-blur px-3 sm:px-4 lg:px-6">
            <SidebarTrigger className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground" />
            <div className="flex items-center gap-2 pl-1 min-w-0">
              <BrandLogo className="h-7 w-7 shrink-0 border border-border" />
              <span className="hidden sm:inline text-sm font-semibold tracking-[0.28em] text-foreground truncate">PEWAND MEDIA</span>
            </div>
            <TutorialControls />
          </header>
          <main className="flex-1 min-w-0 overflow-auto">
            <div className="mx-auto w-full max-w-[1600px]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
