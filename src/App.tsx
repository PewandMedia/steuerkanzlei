import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Mandanten from "./pages/Mandanten";
import MeineMandanten from "./pages/MeineMandanten";
import Statistiken from "./pages/Statistiken";
import MandantProfil from "./pages/MandantProfil";
import BuchhaltungenAbschluesse from "./pages/BuchhaltungenAbschluesse";
import BenutzerVerwaltung from "./pages/BenutzerVerwaltung";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Laden...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function LoginGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Laden...</div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<LoginGuard><Login /></LoginGuard>} />
          <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
          <Route path="/mandanten" element={<AuthGuard><Mandanten /></AuthGuard>} />
          <Route path="/mandanten/:id" element={<AuthGuard><MandantProfil /></AuthGuard>} />
          <Route path="/meine-mandanten" element={<AuthGuard><MeineMandanten /></AuthGuard>} />
          <Route path="/buchhaltungen" element={<AuthGuard><BuchhaltungenAbschluesse /></AuthGuard>} />
          <Route path="/statistiken" element={<AuthGuard><Statistiken /></AuthGuard>} />
          <Route path="/benutzer" element={<AuthGuard><BenutzerVerwaltung /></AuthGuard>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
