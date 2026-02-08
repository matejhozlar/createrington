import type { ReactNode } from "react";

export type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  imageSrc?: string;
  imageAlt?: string;
};

export const PageHeader = ({
  title,
  description,
  imageSrc,
  imageAlt = "",
}: PageHeaderProps) => {
  return (
    <header className="relative w-full overflow-hidden py-12 md:py-16 px-5 md:px-8">
      {imageSrc ? (
        <div className="absolute inset-0">
          <img
            src={imageSrc}
            alt={imageAlt}
            className="h-full w-full object-cover grayscale-50"
          />

          <div className="absolute inset-0 bg-black/50" />
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 h-48 bg-linear-to-t from-background to-transparent" />

      <div className="relative max-w-7xl mx-auto">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-foreground">
          {title}
        </h1>

        {description ? (
          <p className="mt-4 text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-2xl">
            {description}
          </p>
        ) : null}
      </div>
    </header>
  );
};
