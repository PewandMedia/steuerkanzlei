import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

export interface BelegeingangEntry {
  id?: string;
  datum: string;
  notiz?: string | null;
}

interface Props {
  value: BelegeingangEntry[];
  onChange: (next: BelegeingangEntry[]) => void;
  disabled?: boolean;
  label?: string;
  helper?: string;
}

export function BelegeingaengeEditor({ value, onChange, disabled, label = "Belege eingegangen am", helper }: Props) {
  const update = (idx: number, patch: Partial<BelegeingangEntry>) => {
    onChange(value.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };
  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };
  const add = () => {
    const today = new Date().toISOString().split("T")[0];
    onChange([...value, { datum: today, notiz: "" }]);
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {value.length === 0 && (
        <p className="text-[11px] text-muted-foreground">Noch kein Eingangsdatum erfasst.</p>
      )}
      <div className="space-y-2">
        {value.map((entry, idx) => (
          <div key={entry.id ?? `new-${idx}`} className="flex gap-2 items-start">
            <Input
              type="date"
              value={entry.datum}
              onChange={(e) => update(idx, { datum: e.target.value })}
              disabled={disabled}
              className="w-[170px]"
            />
            <Input
              placeholder="Notiz (optional)"
              value={entry.notiz ?? ""}
              onChange={(e) => update(idx, { notiz: e.target.value })}
              disabled={disabled}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(idx)}
              disabled={disabled}
              aria-label="Eintrag entfernen"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={add} disabled={disabled}>
        <Plus className="h-4 w-4 mr-1" /> Eingangsdatum hinzufügen
      </Button>
      {helper && <p className="text-[11px] text-muted-foreground">{helper}</p>}
    </div>
  );
}