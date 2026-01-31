import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/auth";
import {
  WebSocketProvider,
  ServerDataProvider,
  PlayerDataProvider,
} from "./contexts/socket";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Home } from "./pages/Home/Home";
import { Profile } from "./pages/Profile/Profile";
import { Settings } from "./pages/Settings/Settings";
import { ServerDetail } from "./pages/ServerDetail/ServerDetail";
import { ServerStatus } from "./pages/ServerStatus/ServerStatus";
import { Forum } from "./pages/Forum/Forum";
import { Leaderboard } from "./pages/Leaderboard/Leaderboard";
import { Shop } from "./pages/Shop/Shop";
import { NotFound } from "./pages/NotFound/NotFound";
import {
  AdminDashboard,
  AdminWaitlist,
  AdminPlayers,
  AdminSettings,
} from "./pages/Admin";
import { AppSidebar } from "./components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "./components/ui/sidebar";
import { Logo } from "./components/logo";

// Inner component that uses sidebar context
function AppContent() {
  return (
    <SidebarProvider>
      <AppSidebar />

      <SidebarInset>
        <div className="flex md:hidden items-center gap-2 p-2">
          <SidebarTrigger />

          <Logo />
        </div>

        <div className="flex flex-1 flex-col gap-4 pt-0">
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/rules" element={<div>Rules Page</div>} />
            <Route path="/team" element={<div>Team Page</div>} />
            <Route path="/apply-to-join" element={<div>Apply Page</div>} />
            <Route path="/blue-map" element={<div>Map Page</div>} />
            <Route path="/server-chat" element={<div>Chat Page</div>} />
            <Route path="/online-players" element={<div>Players Page</div>} />
            <Route path="/crypto" element={<div>Crypto Page</div>} />

            {/* Market Routes */}
            <Route path="/market" element={<div>Market Dashboard</div>} />
            <Route path="/marketplace" element={<div>Marketplace Page</div>} />
            <Route
              path="/market/companies"
              element={<div>Companies Page</div>}
            />
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

            {/* Admin Routes */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute requiresAdmin>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/waitlist"
              element={
                <ProtectedRoute requiresAdmin>
                  <AdminWaitlist />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/players"
              element={
                <ProtectedRoute requiresAdmin>
                  <AdminPlayers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute requiresAdmin>
                  <AdminSettings />
                </ProtectedRoute>
              }
            />

            {/* 404 Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <WebSocketProvider
        config={{
          autoConnect: true,
          maxReconnectAttempts: 5,
          url: "http://localhost:5000",
          reconnectDelay: 1000,
          healthCheckInterval: 30000,
        }}
      >
        <ServerDataProvider autoSubscribe>
          <PlayerDataProvider autoSubscribe>
            <SidebarProvider>
              <BrowserRouter>
                <AppContent />
              </BrowserRouter>
            </SidebarProvider>
          </PlayerDataProvider>
        </ServerDataProvider>
      </WebSocketProvider>
    </AuthProvider>
  );
}

export default App;
