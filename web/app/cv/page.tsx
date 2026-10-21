import type { Metadata } from "next";

import { AppHeader } from "@/components/AppHeader";
import { CvEditor } from "@/components/CvEditor";

export const metadata: Metadata = { title: "Your CV · Offerpath" };

export default function CvPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6">
      <AppHeader />
      <h2 className="mb-1 text-lg font-semibold">Your CV</h2>
      <p className="mb-4 text-sm text-muted">
        One CV per account. Fit scores and tailoring are based on it.
      </p>
      <CvEditor />
    </main>
  );
}
