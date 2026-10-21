"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cx } from "@/lib/cx";

import { LogoMark } from "./ui/Icons";
import { UserMenu } from "./UserMenu";

const LINKS = [
  { href: "/", label: "Board" },
  { href: "/postings", label: "Postings" },
  { href: "/cv", label: "CV" },
] as const;

/** "/postings/3" belongs to the "/postings" tab; "/" only matches itself. */
function isCurrent(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <LogoMark />
          Offerpath
        </Link>
        <nav aria-label="Main" className="flex h-full items-stretch gap-1">
          {LINKS.map(({ href, label }) => {
            const current = isCurrent(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={current ? "page" : undefined}
                className={cx(
                  "flex items-center border-b-2 px-3 text-sm transition-colors",
                  current
                    ? "border-sage font-medium text-pine"
                    : "border-transparent text-muted hover:text-pine",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
