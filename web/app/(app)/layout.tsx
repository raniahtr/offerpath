import type { ReactNode } from "react";

import { AppHeader } from "@/components/AppHeader";

// Shell for every signed-in page. "(app)" is a route group: it shares this layout without
// adding a segment to the URL, so pages here stay at "/", "/cv", ...
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        {children}
      </main>
    </>
  );
}
