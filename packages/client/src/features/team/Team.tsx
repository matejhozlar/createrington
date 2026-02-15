import { PageHeader } from "@/components/page-header";
import { TeamPodium } from "./components/TeamPodium";

export const Team = () => {
  return (
    <div>
      <PageHeader
        title="Our Team"
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
};
