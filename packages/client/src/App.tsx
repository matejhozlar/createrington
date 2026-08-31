import { lazy, Suspense, useEffect, type ReactNode } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Outlet,
  useLocation,
} from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient, queryClient } from "./lib/trpc";
import { lazyNamed } from "./lib/lazy";
import { AuthProvider, useAuth } from "./contexts/auth";
import { WebSocketProvider } from "./contexts/websocket";
import { ServerDataProvider } from "./contexts/server-data";
import { PlayerDataProvider } from "./contexts/player-data";
import { ProtectedRoute } from "./components/protected-route";
import { OwnerRoute } from "./components/owner-route";
import { Home } from "./pages/Home/Home";
import { NotFound } from "./pages/not-found";
import { ErrorBoundary } from "./components/error-boundary";
import { ToastProvider } from "./components/ui/toast";
import { AppSidebar } from "./components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "./components/ui/sidebar";
import { Logo } from "./components/logo";
import { Footer } from "./components/footer";
import { Loading, LoadingScreen } from "./components/loading-spinner";
import { AdminPlayerProvider } from "./contexts/admin";

// Lazy-loaded routes are code-split. Vite creates a chunk per lazy() call, so
// a logged-out visitor hitting `/` never downloads the admin or
// puppeteer-render bundles. `Home` stays eagerly imported above so the
// first-paint experience has no Suspense fallback.

// Puppeteer render targets (bot-only, not in user navigation)
const CompareRender = lazyNamed(
  () => import("./pages/Render/CompareRender"),
  "CompareRender",
);
const ProfileRender = lazyNamed(
  () => import("./pages/Render/ProfileRender"),
  "ProfileRender",
);
const ActivityRender = lazyNamed(
  () => import("./pages/Render/ActivityRender"),
  "ActivityRender",
);
const TopRender = lazyNamed(
  () => import("./pages/Render/TopRender"),
  "TopRender",
);

// SSO consent screen (standalone, no app shell)
const Authorize = lazyNamed(
  () => import("./features/auth/Authorize"),
  "Authorize",
);

// Public / informational pages
const Rules = lazyNamed(() => import("./features/rules/Rules"), "Rules");
const PrivacyPolicy = lazyNamed(
  () => import("./features/legal/PrivacyPolicy"),
  "PrivacyPolicy",
);
const TermsOfService = lazyNamed(
  () => import("./features/legal/TermsOfService"),
  "TermsOfService",
);
const Team = lazyNamed(() => import("./features/team/Team"), "Team");
const GuideList = lazyNamed(
  () => import("./features/guides/GuideList"),
  "GuideList",
);
const GuideDetail = lazyNamed(
  () => import("./features/guides/GuideDetail"),
  "GuideDetail",
);
const ApplyToJoin = lazyNamed(
  () => import("./pages/ApplyToJoin/ApplyToJoin"),
  "ApplyToJoin",
);
const Donate = lazyNamed(() => import("./features/donate/Donate"), "Donate");
const DonationSuccess = lazyNamed(
  () => import("./features/donate/DonationSuccess"),
  "DonationSuccess",
);
const DonationCancel = lazyNamed(
  () => import("./features/donate/DonationCancel"),
  "DonationCancel",
);
const BlueMap = lazyNamed(() => import("./pages/BlueMap/BlueMap"), "BlueMap");
const OnlinePlayers = lazyNamed(
  () => import("./features/online-players/OnlinePlayers"),
  "OnlinePlayers",
);
const Advertisement = lazyNamed(
  () => import("./pages/Advertisement"),
  "Advertisement",
);

// Protected user pages
const Profile = lazyNamed(() => import("./pages/Profile/Profile"), "Profile");
const Settings = lazyNamed(
  () => import("./pages/Settings/Settings"),
  "Settings",
);
const StructurePacks = lazyNamed(
  () => import("./features/structure-packs/StructurePacks"),
  "StructurePacks",
);
const Workshop = lazyNamed(
  () => import("./features/workshop/Workshop"),
  "Workshop",
);
const WorkshopDetail = lazyNamed(
  () => import("./features/workshop/workshop-detail/WorkshopDetail"),
  "WorkshopDetail",
);
const WorkshopSuggest = lazyNamed(
  () => import("./features/workshop/workshop-suggest/WorkshopSuggest"),
  "WorkshopSuggest",
);
const WorkshopPack = lazyNamed(
  () => import("./features/workshop/workshop-pack/WorkshopPack"),
  "WorkshopPack",
);

// Server pages
const ServerDetail = lazyNamed(
  () => import("./pages/ServerDetail/ServerDetail"),
  "ServerDetail",
);
const ServerStatus = lazyNamed(
  () => import("./pages/ServerStatus/ServerStatus"),
  "ServerStatus",
);
const ServerChat = lazyNamed(() => import("./components/chat"), "ServerChat");
const ChatRedirect = lazyNamed(
  () => import("./components/chat"),
  "ChatRedirect",
);

// Admin feature
const AdminLogs = lazyNamed(
  () => import("./features/admin/AdminLogs"),
  "AdminLogs",
);
const AdminServers = lazyNamed(
  () => import("./features/admin/AdminServers"),
  "AdminServers",
);
const AdminServerDetail = lazyNamed(
  () => import("./features/admin/servers/AdminServerDetail"),
  "AdminServerDetail",
);
const AdminPlayerDetail = lazyNamed(
  () => import("./features/admin/players/AdminPlayerDetail"),
  "AdminPlayerDetail",
);
const AdminPlayers = lazyNamed(
  () => import("./features/admin/AdminPlayers"),
  "AdminPlayers",
);
const AdminWaitlists = lazyNamed(
  () => import("./features/admin/waitlists/AdminWaitlists"),
  "AdminWaitlists",
);
const AdminTools = lazyNamed(
  () => import("./features/admin/tools/AdminTools"),
  "AdminTools",
);
const AdminFaq = lazyNamed(
  () => import("./features/admin/tools/faq/AdminFaq"),
  "AdminFaq",
);
const InactivityManagement = lazyNamed(
  () => import("./features/admin/tools/inactivity/InactivityManagement"),
  "InactivityManagement",
);
const EmbedBuilder = lazyNamed(
  () => import("./features/admin/tools/embed-builder/EmbedBuilder"),
  "EmbedBuilder",
);
const AutoMessages = lazyNamed(
  () => import("./features/admin/tools/auto-messages/AutoMessages"),
  "AutoMessages",
);
const Announcements = lazyNamed(
  () => import("./features/admin/tools/announcements/Announcements"),
  "Announcements",
);
const AdminDashboard = lazyNamed(
  () => import("./features/admin/AdminDashboard"),
  "AdminDashboard",
);
const Changelog = lazyNamed(
  () => import("./features/admin/Changelog"),
  "Changelog",
);
const AdminStructurePacks = lazyNamed(
  () => import("./features/admin/structure-packs/AdminStructurePacks"),
  "AdminStructurePacks",
);
const AdminWorkshop = lazyNamed(
  () => import("./features/admin/workshop/AdminWorkshop"),
  "AdminWorkshop",
);
const AdminWorkshopDetail = lazyNamed(
  () =>
    import("./features/admin/workshop/workshop-admin-detail/AdminWorkshopDetail"),
  "AdminWorkshopDetail",
);
const StructurePackDetail = lazyNamed(
  () =>
    import("./features/admin/structure-packs/structure-pack-detail/StructurePackDetail"),
  "StructurePackDetail",
);
const OwnerDonations = lazyNamed(
  () => import("./features/admin/owner/OwnerDonations"),
  "OwnerDonations",
);
const CommandDocs = lazyNamed(
  () => import("./features/admin/tools/command-docs/CommandDocs"),
  "CommandDocs",
);
const StatSearch = lazyNamed(
  () => import("./features/admin/tools/stat-search/StatSearch"),
  "StatSearch",
);
const AdminParties = lazyNamed(
  () => import("./features/admin/tools/parties/AdminParties"),
  "AdminParties",
);
const AdminPrompts = lazyNamed(
  () => import("./features/admin/tools/prompts/AdminPrompts"),
  "AdminPrompts",
);
const PromptDetail = lazyNamed(
  () => import("./features/admin/tools/prompts/PromptDetail"),
  "PromptDetail",
);
const AdminChatHistory = lazyNamed(
  () => import("./features/admin/tools/chat-history/AdminChatHistory"),
  "AdminChatHistory",
);
const ChatHistoryDetail = lazyNamed(
  () => import("./features/admin/tools/chat-history/ChatHistoryDetail"),
  "ChatHistoryDetail",
);
const OwnerAdmins = lazyNamed(
  () => import("./features/admin/owner/OwnerAdmins"),
  "OwnerAdmins",
);

// Admin chat widget: gated on isAdmin below so non-admins never download it.
const AdminChat = lazyNamed(() => import("./features/admin-chat"), "AdminChat");
const AdminChatProvider = lazy(() =>
  import("./contexts/admin-chat/AdminChatProvider").then((m) => ({
    default: m.AdminChatProvider,
  })),
);

/** Scrolls the window to the top whenever the route pathname changes. */
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

/** Shared shell rendered for all standard routes: sidebar, inset content area, and conditional footer. */
function AppLayout() {
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
            <Outlet />
          </Suspense>
        </div>
        {!hideFooter && <Footer />}
      </SidebarInset>
    </>
  );
}

// Admin chat renders globally but only for admins. Gating here (instead of
// the component returning null) means non-admins never download the chat
// bundle at all.
function AdminChatGate() {
  const { user } = useAuth();
  if (!user?.isAdmin) return null;
  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <AdminChat />
      </Suspense>
    </ErrorBoundary>
  );
}

function AdminChatBoundary({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user?.isAdmin) return <>{children}</>;
  return (
    <Suspense fallback={children}>
      <AdminChatProvider>
        {children}
        <AdminChatGate />
      </AdminChatProvider>
    </Suspense>
  );
}

/** Declares the full client-side route tree, including public, protected, and admin routes. */
function AppContent() {
  return (
    <Suspense fallback={<LoadingScreen text="Loading..." />}>
      <Routes>
        {/* Standalone full-screen route (no sidebar/footer), temporary */}
        <Route path="/ad" element={<Advertisement />} />

        {/* SSO consent screen (standalone, no sidebar/footer) */}
        <Route path="/authorize" element={<Authorize />} />

        {/* Puppeteer render routes (no layout, screenshot targets) */}
        <Route path="/render/compare" element={<CompareRender />} />
        <Route path="/render/profile" element={<ProfileRender />} />
        <Route path="/render/activity" element={<ActivityRender />} />
        <Route path="/render/top" element={<TopRender />} />

        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/team" element={<Team />} />
          <Route path="/guides" element={<GuideList />} />
          <Route path="/guides/:slug" element={<GuideDetail />} />
          <Route path="/apply-to-join" element={<ApplyToJoin />} />
          <Route
            path="/donate"
            element={
              <ProtectedRoute promptLogin>
                <Donate />
              </ProtectedRoute>
            }
          />
          <Route path="/donate/success" element={<DonationSuccess />} />
          <Route path="/donate/cancel" element={<DonationCancel />} />
          <Route path="/blue-map" element={<BlueMap />} />
          <Route path="/online-players" element={<OnlinePlayers />} />
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
          <Route path="/structure-packs" element={<StructurePacks />} />
          <Route
            path="/workshop"
            element={
              <ProtectedRoute promptLogin>
                <Workshop />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workshop/:slug"
            element={
              <ProtectedRoute promptLogin>
                <WorkshopDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workshop/:slug/suggest"
            element={
              <ProtectedRoute promptLogin>
                <WorkshopSuggest />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workshop/:slug/pack"
            element={
              <ProtectedRoute promptLogin>
                <WorkshopPack />
              </ProtectedRoute>
            }
          />

          {/* Server Routes */}
          <Route
            path="/servers/:serverSlug"
            element={
              <ProtectedRoute>
                <ServerDetail />
              </ProtectedRoute>
            }
          />
          <Route path="/servers/status" element={<ServerStatus />} />

          {/* Full-screen Routes (no footer) */}
          <Route path="/chat" element={<ChatRedirect />} />
          <Route path="/chat/:serverSlug" element={<ServerChat />} />

          {/* Admin Routes (no footer) */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute requiresAdmin>
                <AdminPlayerProvider>
                  <ErrorBoundary>
                    <Routes>
                      <Route path="dashboard" element={<AdminDashboard />} />
                      <Route path="waitlist" element={<AdminWaitlists />} />
                      <Route path="players" element={<AdminPlayers />} />
                      <Route
                        path="players/:id"
                        element={<AdminPlayerDetail />}
                      />
                      <Route path="servers" element={<AdminServers />} />
                      <Route
                        path="servers/:id"
                        element={<AdminServerDetail />}
                      />
                      <Route
                        path="tools/structure-packs"
                        element={<AdminStructurePacks />}
                      />
                      <Route
                        path="tools/structure-packs/:id"
                        element={<StructurePackDetail />}
                      />
                      <Route
                        path="tools/workshop"
                        element={<AdminWorkshop />}
                      />
                      <Route
                        path="tools/workshop/:slug"
                        element={<AdminWorkshopDetail />}
                      />
                      <Route path="tools" element={<AdminTools />} />
                      <Route path="tools/faq" element={<AdminFaq />} />
                      <Route
                        path="tools/inactivity"
                        element={<InactivityManagement />}
                      />
                      <Route
                        path="tools/embed-builder"
                        element={<EmbedBuilder />}
                      />
                      <Route
                        path="tools/auto-messages"
                        element={<AutoMessages />}
                      />
                      <Route
                        path="tools/announcements"
                        element={<Announcements />}
                      />
                      <Route
                        path="tools/command-docs"
                        element={<CommandDocs />}
                      />
                      <Route
                        path="tools/stat-search"
                        element={<StatSearch />}
                      />
                      <Route path="tools/parties" element={<AdminParties />} />
                      <Route path="tools/prompts" element={<AdminPrompts />} />
                      <Route
                        path="tools/prompts/:id"
                        element={<PromptDetail />}
                      />
                      <Route
                        path="tools/chat-history"
                        element={<AdminChatHistory />}
                      />
                      <Route
                        path="tools/chat-history/:sessionId"
                        element={<ChatHistoryDetail />}
                      />
                      <Route path="changelog" element={<Changelog />} />
                      <Route path="logs" element={<AdminLogs />} />
                    </Routes>
                  </ErrorBoundary>
                </AdminPlayerProvider>
              </ProtectedRoute>
            }
          />

          {/* Owner-only Routes */}
          <Route
            path="/owner/*"
            element={
              <OwnerRoute>
                <ErrorBoundary>
                  <Routes>
                    <Route path="admins" element={<OwnerAdmins />} />
                    <Route path="donations" element={<OwnerDonations />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </ErrorBoundary>
              </OwnerRoute>
            }
          />

          {/* 404 Route */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

/**
 * Root application component.
 *
 * Establishes the full provider hierarchy required across the app:
 * tRPC → QueryClient → Auth → WebSocket → ServerData → PlayerData → Toast → Router
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
                  <BrowserRouter>
                    <ScrollToTop />
                    <AdminChatBoundary>
                      <ErrorBoundary>
                        <SidebarProvider>
                          <AppContent />
                        </SidebarProvider>
                      </ErrorBoundary>
                    </AdminChatBoundary>
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
