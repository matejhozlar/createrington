import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FEATURES } from "@/features/home/data";
import { SectionHeading } from "./SectionHeading";

export function FeaturesSection() {
  return (
    <section className="relative -mt-px py-12 px-5 md:px-8 bg-background">
      <div className="max-w-7xl mx-auto">
        <SectionHeading
          id="server-features"
          className="items-center mb-12"
          title="Why Join Rails 'n Sails?"
          subtitle="A carefully crafted server designed for engineers and builders alike"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {FEATURES.map((feature) => (
            <Card
              key={feature.title}
              className="overflow-hidden border-border pt-0"
            >
              <div className="p-2">
                <div className="relative aspect-video">
                  <div
                    className="absolute inset-0 bg-cover bg-center rounded-lg"
                    style={{
                      backgroundImage: `url('${feature.backgroundImage}')`,
                    }}
                  />

                  <div className="absolute inset-0 bg-black/70 rounded-lg" />

                  <div className="absolute top-2 left-2">
                    <img
                      src={feature.icon}
                      alt={feature.title}
                      className="max-w-24 max-h-24 shadow-md"
                    />
                  </div>
                </div>
              </div>

              <CardHeader>
                <CardTitle className="text-xl">{feature.title}</CardTitle>

                <CardDescription className="text-base">
                  {feature.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
