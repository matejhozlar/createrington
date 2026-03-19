import { PageHeader } from "@/components/page-header";
import { guides, GUIDE_SECTIONS } from "./data";
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
        <div className="max-w-7xl mx-auto space-y-10">
          {GUIDE_SECTIONS.map(({ category, title }) => {
            const sectionGuides = guides.filter(
              (g) => g.category === category,
            );
            if (sectionGuides.length === 0) return null;

            return (
              <div key={category}>
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  {title}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sectionGuides.map((guide) => (
                    <GuideCard key={guide.slug} guide={guide} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
