import { lazy, Suspense, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Outlet,
  useLocation,
} from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient, queryClient } from "./lib/trpc";
import { AuthProvider, useAuth } from "./contexts/auth";
import { WebSocketProvider } from "./contexts/websocket";
import { ServerDataProvider } from "./contexts/server-data";
import { PlayerDataProvider } from "./contexts/player-data";
import { ProtectedRoute } from "./components/protected-route";
import { Home } from "./pages/Home/Home";
import { Profile } from "./pages/Profile/Profile";
import { Settings } from "./pages/Settings/Settings";
import { ServerDetail } from "./pages/ServerDetail/ServerDetail";
import { ServerStatus } from "./pages/ServerStatus/ServerStatus";
import { Forum } from "./pages/Forum/Forum";
import { Leaderboard } from "./pages/Leaderboard/Leaderboard";
import { Shop } from "./pages/Shop/Shop";
import { NotFound } from "./pages/not-found";
import { ToastProvider } from "./components/ui/toast";
import { AppSidebar } from "./components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "./components/ui/sidebar";
import { Logo } from "./components/logo";
import { ServerChat } from "./components/chat";
import { AdminLogs } from "./features/admin/AdminLogs";
import { AdminServers } from "./features/admin/AdminServers";
import { AdminServerDetail } from "./features/admin/servers/AdminServerDetail";
import { AdminPlayerProvider } from "./contexts/admin";
import { AdminPlayerDetail } from "./features/admin/players/AdminPlayerDetail";
import { AdminPlayers } from "./features/admin/AdminPlayers";
import { AdminWaitlists } from "./features/admin/waitlists/AdminWaitlists";
import { AdminTools } from "./features/admin/tools/AdminTools";
import { AdminFaq } from "./features/admin/tools/faq/AdminFaq";
import { EmbedBuilder } from "./features/admin/tools/embed-builder/EmbedBuilder";
import { AdminDashboard } from "./features/admin/AdminDashboard";
import { AdminCrypto } from "./features/admin/crypto/AdminCrypto";
import { Footer } from "./components/footer";
import { Loading, LoadingScreen } from "./components/loading-spinner";
import { Rules } from "./features/rules/Rules";
import { PrivacyPolicy } from "./features/legal/PrivacyPolicy";
import { TermsOfService } from "./features/legal/TermsOfService";
const Team = lazy(() =>
  import("./features/team/Team").then((m) => ({ default: m.Team })),
);
import { BlueMap } from "./pages/BlueMap/BlueMap";
import { ApplyToJoin } from "./pages/ApplyToJoin/ApplyToJoin";
import { Achievements } from "./pages/Achievements/Achievements";
import { Advertisement } from "./pages/Advertisement";
import { OnlinePlayers } from "./features/online-players/OnlinePlayers";
import { CompareRender } from "./pages/Render/CompareRender";
import { CryptoChartRender } from "./pages/Render/CryptoChartRender";
import { CryptoDataProvider } from "./contexts/crypto-data";
import { CryptoLayout } from "./features/crypto/CryptoLayout";
import { CryptoMarket } from "./features/crypto/market/CryptoMarket";
import { TokenDetail } from "./features/crypto/token-detail/TokenDetail";
import { Portfolio as CryptoPortfolio } from "./features/crypto/portfolio/Portfolio";
import { TradeHistory as CryptoTradeHistory } from "./features/crypto/TradeHistory";
import { Leaderboard as CryptoLeaderboard } from "./features/crypto/Leaderboard";
import { ArticlePage as CryptoArticle } from "./features/crypto/ArticlePage";

// ==========================================================================
// LAYOUT HELPERS
// ==========================================================================

/** Scrolls the window to the top whenever the route pathname changes. */
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

/** Shared shell rendered for all standard routes — sidebar, inset content area, and conditional footer. */
function AppLayout() {
  const { loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen text="Logging in..." />;
  }

  // Footer is hidden on full-screen routes that manage their own layout
  const hideFooter =
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/chat") ||
    location.pathname.startsWith("/blue-map");

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <div className="flex md:hidden items-center gap-2 p-2">
          <SidebarTrigger />
          <Logo />
        </div>
        <div className="flex flex-1 flex-col gap-4">
          <Outlet />
        </div>
        {!hideFooter && <Footer />}
      </SidebarInset>
    </>
  );
}

// ==========================================================================
// ROUTES
// ==========================================================================

/** Declares the full client-side route tree, including public, protected, and admin routes. */
function AppContent() {
  return (
    <Routes>
      {/* Standalone full-screen route (no sidebar/footer) — temporary */}
      <Route path="/ad" element={<Advertisement />} />

      {/* Puppeteer render routes (no layout, screenshot targets) */}
      <Route path="/render/compare" element={<CompareRender />} />
      <Route path="/render/crypto-chart" element={<CryptoChartRender />} />

      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route
          path="/team"
          element={
            <Suspense
              fallback={
                <Loading
                  mode="inline"
                  size="large"
                  text="Loading..."
                  className="flex items-center justify-center py-32"
                />
              }
            >
              <Team />
            </Suspense>
          }
        />
        <Route path="/apply-to-join" element={<ApplyToJoin />} />
        <Route path="/blue-map" element={<BlueMap />} />
        <Route path="/online-players" element={<OnlinePlayers />} />
        <Route path="/crypto" element={<CryptoLayout />}>
          <Route index element={<CryptoMarket />} />
          <Route
            path="portfolio"
            element={
              <ProtectedRoute>
                <CryptoPortfolio />
              </ProtectedRoute>
            }
          />
          <Route
            path="history"
            element={
              <ProtectedRoute>
                <CryptoTradeHistory />
              </ProtectedRoute>
            }
          />
          <Route path="leaderboard" element={<CryptoLeaderboard />} />
          <Route path="news/:id" element={<CryptoArticle />} />
          <Route path=":symbol" element={<TokenDetail />} />
        </Route>

        {/* Market Routes */}
        <Route path="/market" element={<div>Market Dashboard</div>} />
        <Route path="/marketplace" element={<div>Marketplace Page</div>} />
        <Route path="/market/companies" element={<div>Companies Page</div>} />
        <Route path="/market/shops" element={<div>Shops Page</div>} />
        <Route path="/market/requests" element={<div>Requests Page</div>} />

        {/* Protected Routes */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/achievements"
          element={
            <ProtectedRoute>
              <Achievements />
            </ProtectedRoute>
          }
        />

        {/* Server Routes */}
        <Route
          path="/servers/:serverId"
          element={
            <ProtectedRoute>
              <ServerDetail />
            </ProtectedRoute>
          }
        />
        <Route path="/servers/status" element={<ServerStatus />} />

        {/* Additional Routes */}
        <Route path="/forum" element={<Forum />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/shop" element={<Shop />} />

        {/* Full-screen Routes (no footer) */}
        <Route path="/chat/:serverId" element={<ServerChat />} />

        {/* Admin Routes (no footer) */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute requiresAdmin>
              <AdminPlayerProvider>
                <Routes>
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="waitlist" element={<AdminWaitlists />} />
                  <Route path="players" element={<AdminPlayers />} />
                  <Route path="players/:id" element={<AdminPlayerDetail />} />
                  <Route path="servers" element={<AdminServers />} />
                  <Route path="servers/:id" element={<AdminServerDetail />} />
                  <Route path="tools" element={<AdminTools />} />
                  <Route path="tools/faq" element={<AdminFaq />} />
                  <Route
                    path="tools/embed-builder"
                    element={<EmbedBuilder />}
                  />
                  <Route path="tools/crypto" element={<AdminCrypto />} />
                  <Route path="logs" element={<AdminLogs />} />
                </Routes>
              </AdminPlayerProvider>
            </ProtectedRoute>
          }
        />

        {/* 404 Route */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

// ==========================================================================
// ROOT
// ==========================================================================

/**
 * Root application component.
 *
 * Establishes the full provider hierarchy required across the app:
 * tRPC → QueryClient → Auth → WebSocket → ServerData → PlayerData → Toast → CryptoData → Router
 */
function App() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <WebSocketProvider
            config={{
              autoConnect: true,
              maxReconnectAttempts: 5,
              reconnectDelay: 1000,
              healthCheckInterval: 30000,
            }}
          >
            <ServerDataProvider autoSubscribe>
              <PlayerDataProvider autoSubscribe>
                <ToastProvider>
                  <CryptoDataProvider autoSubscribe>
                    <BrowserRouter>
                      <ScrollToTop />
                      <SidebarProvider>
                        <AppContent />
                      </SidebarProvider>
                    </BrowserRouter>
                  </CryptoDataProvider>
                </ToastProvider>
              </PlayerDataProvider>
            </ServerDataProvider>
          </WebSocketProvider>
        </AuthProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export default App;
