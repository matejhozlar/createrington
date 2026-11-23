import type { ReactNode } from "react";
import {
  AdminPageHeader,
  type Crumb,
} from "@/features/admin/components/AdminPageHeader";
import { cn } from "@/lib/utils";

export function AdminPage({
  trail,
  headerActions,
  className,
  children,
}: {
  trail: Crumb[];
  headerActions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminPageHeader trail={trail}>{headerActions}</AdminPageHeader>
      <div
        className={cn(
          "mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 px-4 pb-4",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
