import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ZurueckweisungAlert } from "@/components/ZurueckweisungAlert";
import { BrandLogo } from "@/components/BrandLogo";


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
