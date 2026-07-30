import { cn } from "@/lib/utils";


/**
 * Pewand-Media-Logo als abgerundete Kachel.
 * Das Logo ist dunkelblau, deshalb immer auf hellem Grund darstellen.
 */
export function BrandLogo({
  className,
  imgClassName,
}: {
  className?: string;
  imgClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm",
        className,
      )}
    >
      <img
        src="/logo.png"
        alt="Pewand Media"
        className={cn("max-h-[80%] max-w-[84%] w-auto h-auto object-contain", imgClassName)}
      />
    </div>

  );
}
