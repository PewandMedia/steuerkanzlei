import type { Database } from "@/integrations/supabase/types";
import { getStatusColor } from "@/lib/buchhaltung-workflow";
import { Badge } from "@/components/ui/badge";

type BuchhaltungStatus = Database["public"]["Enums"]["buchhaltung_status"];

export function StatusBadge({ status }: { status: BuchhaltungStatus }) {
  return (
    <Badge className={`${getStatusColor(status)} rounded-full px-2.5 py-0.5 text-[11px] font-medium border`} variant="outline">
      {status}
    </Badge>
  );
}
