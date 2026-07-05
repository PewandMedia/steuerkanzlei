import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Eintrag {
  id: string;
  datum: string;
  notiz: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eintraege: Eintrag[];
  mandantName?: string;
  monat?: string;
}

function fmt(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

export function BelegeingaengeListeDialog({ open, onOpenChange, eintraege, mandantName, monat }: Props) {
  const sorted = [...eintraege].sort((a, b) => a.datum.localeCompare(b.datum));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Alle Belegeingänge</DialogTitle>
          {(mandantName || monat) && (
            <p className="text-xs text-muted-foreground">
              {mandantName}{mandantName && monat ? " · " : ""}{monat}
            </p>
          )}
        </DialogHeader>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Einträge.</p>
        ) : (
          <ol className="space-y-2">
            {sorted.map((e, idx) => (
              <li key={e.id} className="flex gap-3 items-start border rounded-md p-2">
                <span className="text-xs text-muted-foreground w-5 pt-0.5">{idx + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{fmt(e.datum)}</div>
                  {e.notiz && <div className="text-xs text-muted-foreground break-words">{e.notiz}</div>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
