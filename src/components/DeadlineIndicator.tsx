import { getDeadlineStatus, getDaysUntilDeadline, formatDeadline } from "@/lib/deadline-utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface DeadlineIndicatorProps {
  faelligAm: string | null;
  status: string;
  dauerfristverlaengerung?: boolean;
  faelligAmManuell?: boolean;
}

export function DeadlineIndicator({ faelligAm, status, dauerfristverlaengerung, faelligAmManuell }: DeadlineIndicatorProps) {
  const deadlineStatus = getDeadlineStatus(faelligAm, status);
  const days = getDaysUntilDeadline(faelligAm);

  const colorClasses = {
    green: "bg-green-500",
    yellow: "bg-yellow-500",
    red: "bg-red-500",
  };

  const label = (() => {
    if (!faelligAm) return "Kein Fälligkeitsdatum";
    if (deadlineStatus === "green" && (status === "Buchhaltung erledigt")) {
      return `Erledigt · Frist: ${formatDeadline(faelligAm)}`;
    }
    if (days === null) return "";
    if (days < 0) return `${Math.abs(days)} Tage überfällig · ${formatDeadline(faelligAm)}`;
    if (days === 0) return `Heute fällig · ${formatDeadline(faelligAm)}`;
    return `${days} Tage verbleibend · ${formatDeadline(faelligAm)}`;
  })();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-block h-3 w-3 rounded-full",
                colorClasses[deadlineStatus],
                deadlineStatus === "red" && "animate-pulse"
              )}
            />
            <span className="text-xs text-muted-foreground">{formatDeadline(faelligAm)}</span>
            {faelligAmManuell ? (
              <Badge variant="outline" className="h-4 px-1 text-[10px] border-orange-500 text-orange-700 bg-orange-50">
                manuell
              </Badge>
            ) : dauerfristverlaengerung ? (
              <Badge variant="outline" className="h-4 px-1 text-[10px] border-blue-500 text-blue-700 bg-blue-50">
                DFV +1M
              </Badge>
            ) : null}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
          {faelligAmManuell && <p className="text-xs text-orange-600 mt-1">Frist wurde manuell gesetzt</p>}
          {!faelligAmManuell && dauerfristverlaengerung && <p className="text-xs text-blue-600 mt-1">Dauerfristverlängerung aktiv (+1 Monat)</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
