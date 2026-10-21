import type { Metadata } from "next";

import { Postings } from "@/components/postings/Postings";

export const metadata: Metadata = { title: "Postings · Offerpath" };

export default function PostingsPage() {
  return <Postings />;
}
