import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MessageCircle } from "lucide-react";

interface WhatsAppButtonProps {
  telefon: string | null | undefined;
  mandantName?: string | null;
  size?: "default" | "sm" | "icon";
  variant?: "ghost" | "outline" | "default";
  vortext?: string;
}

/**
 * Normalizes a phone number for use with the wa.me click-to-chat API.
 * Returns digits only (with country code) or null if no usable number.
 */
export function normalizePhoneForWhatsApp(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.trim();
  if (!s) return null;

  // Remove common formatting characters
  s = s.replace(/[\s\-().\/]/g, "");

  // 0049... -> +49...
  if (s.startsWith("00")) s = "+" + s.slice(2);

  // Local German number starting with 0 -> +49
  if (s.startsWith("0")) s = "+49" + s.slice(1);

  // If still no leading + and only digits, assume already includes country code
  // wa.me wants only digits
  const digits = s.replace(/[^\d]/g, "");
  if (digits.length < 7) return null;
  return digits;
}

export function WhatsAppButton({
  telefon,
  mandantName,
  size = "icon",
  variant = "ghost",
  vortext,
}: WhatsAppButtonProps) {
  const digits = normalizePhoneForWhatsApp(telefon);
  const disabled = !digits;

  const handleClick = () => {
    if (!digits) return;
    const text = vortext ?? (mandantName ? `Hallo ${mandantName}, ` : "");
    const encoded = text ? encodeURIComponent(text) : "";
    // Offizielle Click-to-Chat-URL von WhatsApp.
    // Routet automatisch: Mobile -> WhatsApp-App, Desktop mit installierter App
    // -> Desktop-App, sonst -> web.whatsapp.com. Funktioniert zuverlaessig
    // unabhaengig vom Login-Status in WhatsApp Web.
    const url = `https://wa.me/${digits}${encoded ? `?text=${encoded}` : ""}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const button = (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled}
      onClick={handleClick}
      className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 disabled:text-muted-foreground"
      aria-label="WhatsApp-Chat öffnen"
    >
      <MessageCircle className="h-4 w-4" />
    </Button>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{button}</span>
        </TooltipTrigger>
        <TooltipContent>
          {disabled ? "Keine Telefonnummer hinterlegt" : "WhatsApp-Chat öffnen"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default WhatsAppButton;