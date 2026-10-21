"use client";

import { useEffect, useState } from "react";

import {
  createPosting,
  deletePosting,
  listPostings,
  type Posting,
  type PostingCreate,
} from "@/lib/api";

import { Button } from "../ui/Button";
import { DocumentIcon, PlusIcon } from "../ui/Icons";
import { PageHeader } from "../ui/PageHeader";
import { EmptyState, ErrorBanner, Loading, Skeleton } from "../ui/States";
import { PostingForm } from "./PostingForm";
import { PostingList } from "./PostingList";

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

/** The postings page: loads the list, adds and deletes postings. */
export function Postings() {
  const [postings, setPostings] = useState<Posting[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listPostings()
      .then((data) => !cancelled && setPostings(data))
      .catch((e: unknown) => !cancelled && setError(errorText(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate(data: PostingCreate) {
    const created = await createPosting(data);
    setPostings((current) => [created, ...(current ?? [])]);
    setAdding(false);
  }

  // Optimistic: remove the row at once, put it back if the API refuses.
  async function handleDelete(posting: Posting) {
    if (!window.confirm(`Delete ${posting.title} at ${posting.company}?`)) {
      return;
    }
    setError(null);
    setPostings((current) =>
      (current ?? []).filter((p) => p.id !== posting.id),
    );
    try {
      await deletePosting(posting.id);
    } catch (e) {
      setPostings((current) => [posting, ...(current ?? [])]);
      setError(`Could not delete: ${errorText(e)}`);
    }
  }

  const empty = postings !== null && postings.length === 0;
  const showForm = adding || empty;

  return (
    <>
      <PageHeader
        title="Postings"
        description="Job ads you are considering. Paste one to check how your CV fits it."
        actions={
          !showForm && (
            <Button variant="primary" onClick={() => setAdding(true)}>
              <PlusIcon width={14} height={14} />
              New posting
            </Button>
          )
        }
      />
      <div className="grid gap-5">
        {error && <ErrorBanner>{error}</ErrorBanner>}
        {showForm && (
          <PostingForm
            onCreate={handleCreate}
            onCancel={empty ? undefined : () => setAdding(false)}
          />
        )}
        {postings === null && !error && (
          <Loading label="Loading postings…" className="grid gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </Loading>
        )}
        {empty && (
          <EmptyState
            icon={<DocumentIcon width={28} height={28} />}
            title="No postings yet"
          >
            Paste your first job ad above. Your postings are private and only
            used to compare them with your CV.
          </EmptyState>
        )}
        {postings && postings.length > 0 && (
          <PostingList postings={postings} onDelete={handleDelete} />
        )}
      </div>
    </>
  );
}
