import type { ReactNode } from "react";

interface GuideLinkProps {
  href: string;
  children: ReactNode;
}

export function GuideLink({ href, children }: GuideLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:text-primary/80"
    >
      {children}
    </a>
  );
}
