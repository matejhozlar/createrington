/**
 * Standard admin header action group: the controls that sit beside a page or
 * card title. Stays a row while it fits, then stacks full-width on the
 * narrowest screens so the controls never overflow the viewport. Fixed-size
 * children (icon buttons) keep their width when stacked.
 */
export function HeaderActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2 min-[440px]:w-auto min-[440px]:flex-row min-[440px]:items-center">
      {children}
    </div>
  );
}
