"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { UserMenu } from "./UserMenu";

const LINKS = [
  { href: "/", label: "Board" },
  { href: "/cv", label: "CV" },
] as const;

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-6">
        <h1 className="text-2xl font-semibold">Offerpath</h1>
        <nav aria-label="Main" className="flex gap-1 text-sm">
          {LINKS.map(({ href, label }) => {
            const current = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={current ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 ${current ? "bg-sage-soft font-medium" : "hover:bg-sage-soft"}`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
      <UserMenu />
    </header>
  );
}
