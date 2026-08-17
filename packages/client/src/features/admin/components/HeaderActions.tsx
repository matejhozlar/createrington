/**
 * Standard admin header action group: the controls that sit beside a page or
 * card title. Stays a row while it fits, wraps within itself once it does not,
 * and stacks full-width below the `xs` breakpoint. Fixed-size children (icon
 * buttons) keep their width when stacked.
 */
export function HeaderActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2 xs:w-auto xs:flex-row xs:flex-wrap xs:items-center xs:justify-end">
      {children}
    </div>
  );
}
