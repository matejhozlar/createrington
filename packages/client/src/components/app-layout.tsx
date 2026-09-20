import { Suspense, type ReactNode } from "react";
import { Outlet, useLocation } from "react-router";
import { useAuth } from "@/contexts/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Logo } from "@/components/logo";
import { Footer } from "@/components/footer";
import { Loading, LoadingScreen } from "@/components/loading-spinner";

export function AppLayout({ children }: { children?: ReactNode }) {
  const { loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen text="Logging in..." />;
  }

  const hideFooter =
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/owner") ||
    location.pathname.startsWith("/chat") ||
    location.pathname.startsWith("/blue-map");

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <div className="sticky top-0 z-30 flex h-14 md:hidden items-center gap-2 p-2 bg-background border-b">
          <SidebarTrigger />
          <Logo />
        </div>
        <div className="flex flex-1 flex-col gap-4">
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center p-10">
                <Loading mode="inline" size="large" />
              </div>
            }
          >
            {children ?? <Outlet />}
          </Suspense>
        </div>
        {!hideFooter && <Footer />}
      </SidebarInset>
    </>
  );
}
