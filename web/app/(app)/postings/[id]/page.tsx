import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PostingDetail } from "@/components/postings/PostingDetail";

export const metadata: Metadata = { title: "Posting · Offerpath" };

export default async function PostingPage({
  params,
}: PageProps<"/postings/[id]">) {
  const { id } = await params;
  const postingId = Number(id);
  // "/postings/abc" can't be a posting: show the 404 page without calling the API.
  if (!Number.isInteger(postingId) || postingId <= 0) notFound();
  return <PostingDetail id={postingId} />;
}
