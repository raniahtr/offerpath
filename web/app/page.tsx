import { AppHeader } from "@/components/AppHeader";
import { Board } from "@/components/Board";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      <AppHeader />
      <Board />
    </main>
  );
}
