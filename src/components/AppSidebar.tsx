import { LayoutDashboard, Users, BarChart3, LogOut, FileSpreadsheet, UserCircle2, ShieldCheck, Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { UserAvatar } from "@/components/UserAvatar";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { NotificationBell } from "@/components/NotificationBell";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";


export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const location = useLocation();
  const { rolle, benutzerName, signOut, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };
  const handleSignOut = () => {
    closeMobile();
    signOut();
  };

  const workflowItems = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, visible: true },
    { title: "Meine Mandanten", url: "/meine-mandanten", icon: UserCircle2, visible: rolle === "Sachbearbeiter" || rolle === "Chef" },
    { title: "Mandanten", url: "/mandanten", icon: Users, visible: rolle === "Sekretariat" || rolle === "Chef" },
  ].filter((i) => i.visible);

  const auswertungItems = [
    { title: "Erstellte Buchhaltungen", url: "/buchhaltungen", icon: FileSpreadsheet, visible: rolle === "Sachbearbeiter" || rolle === "Chef" },
    { title: "Statistiken", url: "/statistiken", icon: BarChart3, visible: rolle === "Chef" },
  ].filter((i) => i.visible);

  const adminItems = [
    { title: "Benutzer", url: "/benutzer", icon: ShieldCheck, visible: rolle === "Chef" },
  ].filter((i) => i.visible);

  const renderGroup = (label: string, groupItems: typeof workflowItems) =>
    groupItems.length === 0 ? null : (
      <SidebarGroup>
        <SidebarGroupLabel className="section-label px-3 pt-4 pb-2">{label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu className="gap-0.5">
            {groupItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === item.url}
                  className="relative h-11 md:h-9 rounded-md text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-semibold data-[active=true]:before:absolute data-[active=true]:before:left-0 data-[active=true]:before:top-1.5 data-[active=true]:before:bottom-1.5 data-[active=true]:before:w-[3px] data-[active=true]:before:rounded-r-full data-[active=true]:before:bg-brand"
                >
                  <NavLink to={item.url} end onClick={closeMobile}>
                    <item.icon className="mr-2 h-4 w-4 shrink-0" />
                    {!collapsed && <span className="flex-1 truncate">{item.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <BrandLogo className="h-9 w-9 border border-border" />

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-semibold tracking-[0.28em] text-foreground leading-none">PEWAND MEDIA</h2>
                <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-brand">Demo</span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-1">{benutzerName} · {rolle}</p>
            </div>

          </div>
        ) : (
          <div className="flex justify-center">
            <BrandLogo className="h-8 w-8 border border-border" />
          </div>

        )}
      </SidebarHeader>

      <SidebarContent className="px-2" data-tour="sidebar">
        {renderGroup("Workflow", workflowItems)}
        {renderGroup("Auswertung", auswertungItems)}
        {renderGroup("Verwaltung", adminItems)}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <UserAvatar seed={user?.id ?? benutzerName} name={benutzerName} email={user?.email} size="md" />
            <span className="inline-flex"><NotificationBell /></span>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              title={isDark ? "Helles Design" : "Dunkles Design"}
              className="text-muted-foreground hover:text-foreground"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              title="Abmelden"
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3 rounded-lg border border-sidebar-border bg-card p-2.5">
              <UserAvatar
                seed={user?.id ?? benutzerName}
                name={benutzerName}
                email={user?.email}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate leading-tight">
                  {benutzerName ?? "\u2014"}
                </p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={user?.email ?? ""}>
                  {user?.email ?? ""}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isDark}
                aria-label={isDark ? "Zu hellem Design wechseln" : "Zu dunklem Design wechseln"}
                onClick={toggleTheme}
                className="relative shrink-0 h-7 w-12 rounded-full border border-sidebar-border bg-muted/60 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              >
                <span className="pointer-events-none absolute inset-0 flex items-center justify-between px-1.5 text-muted-foreground">
                  <Sun className={`h-3.5 w-3.5 transition-opacity ${isDark ? "opacity-40" : "opacity-100 text-amber-500"}`} />
                  <Moon className={`h-3.5 w-3.5 transition-opacity ${isDark ? "opacity-100 text-brand" : "opacity-40"}`} />
                </span>
                <span
                  className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-background shadow-sm border border-border transition-transform duration-200 ${isDark ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>
            <span className="block"><NotificationBell variant="full" /></span>
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="w-full justify-start gap-2 h-11 md:h-9 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Abmelden
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
