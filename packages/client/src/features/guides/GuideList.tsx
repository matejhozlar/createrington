import { PageHeader } from "@/components/page-header";
import { guides } from "./data";
import { GuideCard } from "./components/GuideCard";

export const GuideList = () => {
  return (
    <div>
      <PageHeader
        title="Guides"
        description="Step-by-step guides to help you get started and make the most of Createrington."
        imageSrc="/assets/hero/mountains-train-station.webp"
      />

      <section className="pb-12 md:py-16 px-5 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {guides.map((guide) => (
              <GuideCard key={guide.slug} guide={guide} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
