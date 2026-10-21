import { Board } from "@/components/Board";
import { PageHeader } from "@/components/ui/PageHeader";

export default function Home() {
  return (
    <>
      <PageHeader
        title="Applications"
        description="Every application, by stage. Change a card's status to move it."
      />
      <Board />
    </>
  );
}
