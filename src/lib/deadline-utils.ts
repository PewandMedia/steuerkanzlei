export type DeadlineStatus = "green" | "yellow" | "red";

export function getDeadlineStatus(
  faelligAm: string | null,
  status: string
): DeadlineStatus {
  // Completed items are always green
  if (status === "Buchhaltung erledigt") {
    return "green";
  }

  if (!faelligAm) return "green";

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const deadline = new Date(faelligAm);
  deadline.setHours(0, 0, 0, 0);

  const diffMs = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "red";
  if (diffDays <= 7) return "yellow";
  return "green";
}

export function getDaysUntilDeadline(faelligAm: string | null): number | null {
  if (!faelligAm) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const deadline = new Date(faelligAm);
  deadline.setHours(0, 0, 0, 0);
  return Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDeadline(faelligAm: string | null): string {
  if (!faelligAm) return "–";
  return new Date(faelligAm).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
