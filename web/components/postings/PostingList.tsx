import type { Posting } from "@/lib/api";
import { safeHref } from "@/lib/url";

import { ExternalIcon, TrashIcon } from "../ui/Icons";

interface PostingListProps {
  postings: Posting[];
  onDelete: (posting: Posting) => void;
}

function addedOn(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function PostingList({ postings, onDelete }: PostingListProps) {
  return (
    <ul
      aria-label="Your postings"
      className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface shadow-xs"
    >
      {postings.map((posting) => {
        const label = `${posting.title}, ${posting.company}`;
        const href = safeHref(posting.url);
        return (
          <li
            key={posting.id}
            aria-label={label}
            className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-mist/50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{posting.title}</p>
              <p className="truncate text-sm text-muted">
                {posting.company}
                {posting.location && <> · {posting.location}</>}
              </p>
            </div>
            <span className="hidden shrink-0 text-xs text-muted sm:inline">
              Added {addedOn(posting.created_at)}
            </span>
            <div className="flex shrink-0 items-center">
              {href && (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open the ad for ${label}`}
                  className="rounded-md p-1.5 text-muted hover:bg-mist hover:text-pine"
                >
                  <ExternalIcon width={14} height={14} />
                </a>
              )}
              <button
                type="button"
                onClick={() => onDelete(posting)}
                aria-label={`Delete ${label}`}
                className="rounded-md p-1.5 text-muted hover:bg-mist hover:text-pine"
              >
                <TrashIcon width={14} height={14} />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
