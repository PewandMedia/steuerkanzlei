import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  page: number;
  totalPages: number;
  total: number;
  shown: number;
  onPageChange: (p: number) => void;
  label?: string;
  className?: string;
  pageSize?: number;
  onPageSizeChange?: (n: number) => void;
  pageSizeOptions?: number[];
}

function buildRange(current: number, total: number): (number | "ellipsis-l" | "ellipsis-r")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | "ellipsis-l" | "ellipsis-r")[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) items.push("ellipsis-l");
  for (let i = left; i <= right; i++) items.push(i);
  if (right < total - 1) items.push("ellipsis-r");
  items.push(total);
  return items;
}

export function PaginationFooter({
  page,
  totalPages,
  total,
  shown,
  onPageChange,
  label = "Einträge",
  className = "",
  pageSize = 10,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}: Props) {
  if (total === 0) return null;

  const sizeSelector = onPageSizeChange ? (
    <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1 shadow-sm backdrop-blur">
      <span className="text-xs text-muted-foreground">Pro Seite</span>
      <Select
        value={String(pageSize)}
        onValueChange={(v) => onPageSizeChange(Number(v))}
      >
        <SelectTrigger className="h-7 w-[68px] rounded-full border-0 bg-transparent px-2 text-xs font-semibold tabular-nums focus:ring-0 focus:ring-offset-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end" className="min-w-[80px]">
          {pageSizeOptions.map((opt) => (
            <SelectItem key={opt} value={String(opt)} className="text-xs tabular-nums">
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ) : null;

  // Single page → quiet status line
  if (totalPages <= 1) {
    return (
      <div
        className={cn(
          "mt-2 flex flex-col items-center justify-center gap-3 border-t border-border/60 py-4 text-xs text-muted-foreground sm:flex-row sm:gap-4",
          className,
        )}
      >
        <span>
          <span className="font-semibold text-foreground tabular-nums">
            {total.toLocaleString("de-DE")}
          </span>
          <span className="ml-1.5">{label}</span>
        </span>
        {sizeSelector}
      </div>
    );
  }

  const range = buildRange(page, totalPages);
  const from = (page - 1) * pageSize + 1;
  const to = (page - 1) * pageSize + shown;

  const handle = (n: number) => {
    if (n !== page) onPageChange(n);
  };

  return (
    <div
      className={cn(
        "mt-2 flex flex-col items-center gap-3.5 border-t border-border/60 py-5",
        className,
      )}
    >
      <p className="text-xs text-muted-foreground">
        Seite{" "}
        <span className="font-semibold text-foreground tabular-nums">{page}</span>{" "}
        von{" "}
        <span className="font-semibold text-foreground tabular-nums">
          {totalPages}
        </span>
        <span className="mx-2 text-border">•</span>
        <span className="font-semibold text-foreground tabular-nums">
          {from.toLocaleString("de-DE")}–{to.toLocaleString("de-DE")}
        </span>{" "}
        von{" "}
        <span className="font-semibold text-foreground tabular-nums">
          {total.toLocaleString("de-DE")}
        </span>{" "}
        {label}
      </p>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
      <nav
        aria-label="Pagination"
        className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/50 p-1 shadow-sm backdrop-blur"
      >
        <Button
          variant="ghost"
          size="sm"
          disabled={page <= 1}
          onClick={() => handle(page - 1)}
          className="h-8 gap-1 rounded-full px-3 text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Zurück</span>
        </Button>

        <div className="mx-1 h-5 w-px bg-border/60" />

        {range.map((item, idx) =>
          item === "ellipsis-l" || item === "ellipsis-r" ? (
            <span
              key={`${item}-${idx}`}
              className="flex h-8 w-8 items-center justify-center text-muted-foreground"
              aria-hidden
            >
              <MoreHorizontal className="h-4 w-4" />
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => handle(item)}
              aria-current={item === page ? "page" : undefined}
              className={cn(
                "inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2.5 text-sm tabular-nums transition-all",
                item === page
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "text-foreground hover:bg-muted",
              )}
            >
              {item}
            </button>
          ),
        )}

        <div className="mx-1 h-5 w-px bg-border/60" />

        <Button
          variant="ghost"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => handle(page + 1)}
          className="h-8 gap-1 rounded-full px-3 text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <span className="hidden sm:inline">Weiter</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </nav>
      {sizeSelector}
      </div>
    </div>
  );
}
