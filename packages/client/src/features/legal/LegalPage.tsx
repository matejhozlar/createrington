import { Fragment } from "react";
import { NavLink } from "react-router";
import { PageHeader } from "@/components/page-header";
import { Separator } from "@/components/ui/separator";

export type LegalSection = { title: string; content: React.ReactNode };

export function LegalPage({
  title,
  description,
  effectiveDate,
  sections,
  related,
}: {
  title: string;
  description: string;
  effectiveDate: string;
  sections: LegalSection[];
  related: { to: string; label: string };
}) {
  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        imageSrc="/assets/hero/dark-warehouse.webp"
      />

      <section className="px-5 pb-12 md:px-8 md:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-5xl">
            <p className="mb-8 text-sm text-muted-foreground">
              Effective date: {effectiveDate}
            </p>

            <div className="flex flex-col gap-6">
              {sections.map((section, index) => (
                <Fragment key={section.title}>
                  {index > 0 ? <Separator className="my-2" /> : null}

                  <div>
                    <h2 className="mb-3 text-xl font-semibold text-foreground md:text-2xl">
                      {section.title}
                    </h2>

                    <div className="text-base/7 text-muted-foreground">
                      {section.content}
                    </div>
                  </div>
                </Fragment>
              ))}
            </div>

            <Separator className="my-6" />

            <p className="text-sm text-muted-foreground">
              Please also review our{" "}
              <NavLink to={related.to} className="text-primary hover:underline">
                {related.label}
              </NavLink>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
