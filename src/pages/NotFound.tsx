import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";

const NotFound = () => {
  const location = useLocation();
  usePageMeta("Seite nicht gefunden", "Die angeforderte Seite existiert nicht.");

  useEffect(() => {
    console.error("404: Route nicht gefunden:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Seite nicht gefunden</p>
        <a href="/dashboard" className="text-primary underline hover:text-primary/90">
          Zurück zum Dashboard
        </a>
      </div>
    </div>
  );
};

export default NotFound;
