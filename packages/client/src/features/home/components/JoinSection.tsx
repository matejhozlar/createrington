import { NavLink } from "react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function JoinSection() {
  return (
    <section className="bg-muted py-16 px-5 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex w-full flex-col items-center justify-between gap-8 text-center md:flex-row md:text-left">
          <h2 className="text-foreground text-4xl md:text-5xl font-semibold max-w-lg text-pretty">
            Join Us and Build Something Amazing
          </h2>

          <div className="flex flex-col gap-3 md:flex-row">
            <Button size="lg" asChild>
              <NavLink to="/apply-to-join" className="text-xl! px-8! py-6!">
                Apply Now
                <ArrowRight />
              </NavLink>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
