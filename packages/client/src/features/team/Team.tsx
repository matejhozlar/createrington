import { PageHeader } from "@/components/page-header";
import { TeamPodium } from "./components/TeamPodium";
import { startDisco } from "./effects/disco";

export function Team() {
  return (
    <div className="overflow-x-clip">
      <PageHeader
        title={
          <span className="cursor-pointer select-none" onClick={startDisco}>
            Our Team
          </span>
        }
        description="Meet the people who keep Createrington running."
        imageSrc="/assets/hero/gondola-station.webp"
      />

      <section className="pb-12 md:py-16 px-5 md:px-8">
        <div className="max-w-7xl mx-auto">
          <TeamPodium />
        </div>
      </section>
    </div>
  );
}
