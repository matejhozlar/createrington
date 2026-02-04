import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { AuthProvider } from "./contexts/auth";
import {
  WebSocketProvider,
  ServerDataProvider,
  PlayerDataProvider,
} from "./contexts/socket";
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
import { AdminDashboard, AdminSettings } from "./pages/Admin";
import { AppSidebar } from "./components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "./components/ui/sidebar";
import { Logo } from "./components/logo";
import { ServerChat } from "./components/chat";
import { AdminLogs } from "./pages/Admin/Logs";
import { AdminMessages } from "./pages/Admin/Messages";
import { AdminServers } from "./pages/Admin/Servers";
import { AdminPlayerProvider } from "./contexts/admin";
import { AdminPlayerDetail } from "./features/admin/players/detail/AdminPlayerDetail";
import { AdminPlayers } from "./features/admin/players/AdminPlayers";
import { AdminWaitlists } from "./features/admin/waitlists/AdminWaitlists";
import { Footer } from "./components/footer";

// Layout WITH footer
function DefaultLayout() {
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
        <Footer />
      </SidebarInset>
    </>
  );
}

// Layout WITHOUT footer (for chat, full-screen pages, etc.)
function FullScreenLayout() {
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
      </SidebarInset>
    </>
  );
}

function AppContent() {
  return (
    <Routes>
      {/* Routes WITH footer */}
      <Route element={<DefaultLayout />}>
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

        {/* 404 Route */}
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Routes WITHOUT footer (full-screen) */}
      <Route element={<FullScreenLayout />}>
        <Route path="/chat/:serverId" element={<ServerChat />} />

        {/* Admin Routes - also without footer */}
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
                  <Route path="messages" element={<AdminMessages />} />
                  <Route path="settings" element={<AdminSettings />} />
                  <Route path="logs" element={<AdminLogs />} />
                </Routes>
              </AdminPlayerProvider>
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
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
  );
}

export default App;
