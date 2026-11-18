export function HeaderActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2 xs:w-auto xs:flex-row xs:flex-wrap xs:items-center xs:justify-end">
      {children}
    </div>
  );
}
