import { cn } from "@/lib/utils";
import { avatarColor, initials } from "@/lib/avatar";

interface Props {
  name?: string | null;
  email?: string | null;
  /** Seed für die Farbe (z. B. user_id), damit der Avatar konsistent bleibt
   *  auch wenn der Name geändert wird. Fällt zurück auf name/email. */
  seed?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  ring?: boolean;
}

const SIZE: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-11 w-11 text-sm",
  xl: "h-14 w-14 text-base",
};

export function UserAvatar({ name, email, seed, size = "md", className, ring }: Props) {
  const palette = avatarColor(seed ?? name ?? email);
  const text = initials(name, email);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight select-none",
        SIZE[size],
        ring && "ring-2 ring-background shadow-sm",
        className,
      )}
      style={{ backgroundColor: palette.bg, color: palette.fg }}
      aria-hidden
    >
      {text}
    </span>
  );
}
