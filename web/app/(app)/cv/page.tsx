import type { Metadata } from "next";

import { CvEditor } from "@/components/CvEditor";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Your CV · Offerpath" };

export default function CvPage() {
  return (
    <>
      <PageHeader
        title="Your CV"
        description="One CV per account. Fit scores and tailored versions are built from it."
      />
      <CvEditor />
    </>
  );
}
