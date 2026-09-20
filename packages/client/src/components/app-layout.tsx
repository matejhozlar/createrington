import { Suspense, type ReactNode } from "react";
import { Outlet, useLocation } from "react-router";
import { useAuth } from "@/contexts/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Logo } from "@/components/logo";
import { Footer } from "@/components/footer";
import { Loading, LoadingScreen } from "@/components/loading-spinner";

/** Shared shell rendered for all standard routes: sidebar, inset content area, and conditional footer. */
export function AppLayout({ children }: { children?: ReactNode }) {
  const { loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen text="Logging in..." />;
  }

  // Footer is hidden on full-screen routes that manage their own layout
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
          {/* Inner Suspense so lazy-loading a layout-child route only swaps
              the content area, the sidebar and mobile top bar stay
              mounted instead of flashing a full-screen loader. */}
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
