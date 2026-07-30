import logoAsset from "@/assets/logo.png.asset.json";
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
        src={logoAsset.url}
        alt="Pewand Media"
        loading="lazy"
        className={cn("h-auto w-[78%] object-contain", imgClassName)}
      />
    </div>
  );
}
