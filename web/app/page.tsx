import { Board } from "@/components/Board";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold">Offerpath</h1>
      <Board />
    </main>
  );
}
