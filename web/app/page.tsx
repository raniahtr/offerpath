import { Board } from "@/components/Board";
import { UserMenu } from "@/components/UserMenu";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      <header className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Offerpath</h1>
        <UserMenu />
      </header>
      <Board />
    </main>
  );
}
