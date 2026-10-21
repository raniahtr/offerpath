import type { ApplicationStatus } from "@/lib/api";

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

/** Dot color per stage. Always shown next to the label, never instead of it. */
export const STATUS_DOTS: Record<ApplicationStatus, string> = {
  saved: "bg-muted/50",
  applied: "bg-sky",
  interview: "bg-amber",
  offer: "bg-sage",
  rejected: "bg-rose",
};
