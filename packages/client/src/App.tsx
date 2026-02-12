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
import { AdminLogs } from "./features/admin/logs/AdminLogs";
import { AdminServers } from "./features/admin/servers/AdminServers";
import { AdminServerDetail } from "./features/admin/servers/detail/AdminServerDetail";
import { AdminPlayerProvider } from "./contexts/admin";
import { AdminPlayerDetail } from "./features/admin/players/detail/AdminPlayerDetail";
import { AdminPlayers } from "./features/admin/players/AdminPlayers";
import { AdminWaitlists } from "./features/admin/waitlists/AdminWaitlists";
import { AdminDashboard } from "./features/admin/dashboard/AdminDashboard";
import { Footer } from "./components/footer";
import { LoadingScreen } from "./components/loading-spinner";
import { Rules } from "./features/rules/Rules";
import { ApplyToJoin } from "./pages/ApplyToJoin/ApplyToJoin";
import { Achievements } from "./pages/Achievements/Achievements";
import { Advertisement } from "./pages/Advertisement";

function AppLayout() {
  const { loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen text="Logging in..." />;
  }

  const hideFooter =
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/chat");

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

function AppContent() {
  return (
    <Routes>
      {/* Standalone full-screen route (no sidebar/footer) — temporary */}
      <Route path="/ad" element={<Advertisement />} />

      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/team" element={<div>Team Page</div>} />
        <Route path="/apply-to-join" element={<ApplyToJoin />} />
        <Route path="/blue-map" element={<div>Map Page</div>} />
        <Route path="/server-chat" element={<div>Chat Page</div>} />
        <Route path="/online-players" element={<div>Players Page</div>} />
        <Route path="/crypto" element={<div>Crypto Page</div>} />

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
                  <BrowserRouter>
                    <SidebarProvider>
                      <AppContent />
                    </SidebarProvider>
                  </BrowserRouter>
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
