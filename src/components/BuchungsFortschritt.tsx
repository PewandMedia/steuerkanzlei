import { Progress } from "@/components/ui/progress";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBuchungsFortschritt } from "@/hooks/use-buchungs-fortschritt";

interface Props {
  buchhaltungId: string;
  variant?: "full" | "compact";
  className?: string;
  /** @deprecated Realtime macht das überflüssig — Prop wird ignoriert. */
  refreshKey?: number;
}

export function BuchungsFortschritt({ buchhaltungId, variant = "full", className }: Props) {
  const { total, gebucht, pct, allBooked, loading } = useBuchungsFortschritt(buchhaltungId);

  if (loading) {
    if (variant === "compact") return <span className={cn("text-xs text-muted-foreground", className)}>…</span>;
    return null;
  }

  if (total === 0) {
    if (variant === "compact") return <span className={cn("text-xs text-muted-foreground", className)}>Keine Belege</span>;
    return null;
  }

  if (variant === "compact") {
    return (
      <div className={cn("space-y-1 min-w-[160px]", className)}>
        <div className="flex items-center gap-2">
          <Progress value={pct} className="h-1.5 flex-1" />
          <span className={cn("text-xs whitespace-nowrap font-medium", allBooked ? "text-green-600" : "text-muted-foreground")}>
            {pct}%
          </span>
        </div>
        <span className={cn("text-[11px] block", allBooked ? "text-green-600 font-medium" : "text-muted-foreground")}>
          {gebucht} / {total} Belege gebucht
        </span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground flex items-center gap-1.5">
          {allBooked && <CheckCircle2 className="h-4 w-4 text-green-600" />}
          {gebucht} von {total} Belegen gebucht
        </span>
        <span className={cn("text-xs", allBooked ? "text-green-600 font-medium" : "text-muted-foreground")}>
          {pct}%
        </span>
      </div>
      <Progress value={pct} className="h-2" />
      {allBooked && (
        <p className="text-xs text-green-600">Alle Belege erfasst — bereit zur Prüfung.</p>
      )}
    </div>
  );
}
