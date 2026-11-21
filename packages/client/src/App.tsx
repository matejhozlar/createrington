import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/trpc";
import { lazyNamed } from "./lib/lazy";
import { AuthProvider, useAuth } from "./contexts/auth";
import { WebSocketProvider } from "./contexts/websocket";
import { ServerDataProvider } from "./contexts/server-data";
import { PlayerDataProvider } from "./contexts/player-data";
import { ProtectedRoute } from "./components/protected-route";
import { OwnerRoute } from "./components/owner-route";
import { LAUNCHER_ENABLED } from "./lib/launcher";
import { Home } from "./features/home/Home";
import { NotFound } from "./components/not-found";
import { ErrorBoundary } from "./components/error-boundary";
import { ToastProvider } from "./components/ui/toast";
import { AppLayout } from "./components/app-layout";
import { SidebarProvider } from "./components/ui/sidebar";
import { LoadingScreen } from "@/components/query-states";
import { AdminPlayersProvider } from "./contexts/admin";

const CompareRender = lazyNamed(
  () => import("./features/render/CompareRender"),
  "CompareRender",
);
const ProfileRender = lazyNamed(
  () => import("./features/render/ProfileRender"),
  "ProfileRender",
);
const ActivityRender = lazyNamed(
  () => import("./features/render/ActivityRender"),
  "ActivityRender",
);
const TopRender = lazyNamed(
  () => import("./features/render/TopRender"),
  "TopRender",
);
const TagRender = lazyNamed(
  () => import("./features/render/TagRender"),
  "TagRender",
);
const RecordsRender = lazyNamed(
  () => import("./features/render/RecordsRender"),
  "RecordsRender",
);

const Authorize = lazyNamed(
  () => import("./features/auth/Authorize"),
  "Authorize",
);

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
const TeamTag = lazyNamed(
  () => import("./features/team-tag/TeamTag"),
  "TeamTag",
);
const Leaderboards = lazyNamed(
  () => import("./features/leaderboards/Leaderboards"),
  "Leaderboards",
);
const LeaderboardsCompare = lazyNamed(
  () => import("./features/leaderboards/compare/Compare"),
  "Compare",
);
const Gallery = lazyNamed(
  () => import("./features/gallery/Gallery"),
  "Gallery",
);
const GuideList = lazyNamed(
  () => import("./features/guides/GuideList"),
  "GuideList",
);
const GuideDetail = lazyNamed(
  () => import("./features/guides/GuideDetail"),
  "GuideDetail",
);
const ApplyToJoin = lazyNamed(
  () => import("./features/apply-to-join/ApplyToJoin"),
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
const BlueMap = lazyNamed(
  () => import("./features/bluemap/BlueMap"),
  "BlueMap",
);
const OnlinePlayers = lazyNamed(
  () => import("./features/online-players/OnlinePlayers"),
  "OnlinePlayers",
);
const Advertisement = lazyNamed(
  () => import("./features/advertisement/Advertisement"),
  "Advertisement",
);
const AnnouncementTable = import.meta.env.DEV
  ? lazyNamed(
      () => import("./features/dev/announcement-table/AnnouncementTable"),
      "AnnouncementTable",
    )
  : null;

const Settings = lazyNamed(
  () => import("./features/settings/Settings"),
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

const ServerChat = lazyNamed(() => import("./features/chat"), "ServerChat");
const ChatRedirect = lazyNamed(() => import("./features/chat"), "ChatRedirect");

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
  () => import("./features/admin/players/AdminPlayers"),
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
const AdminDashboard = lazyNamed(
  () => import("./features/admin/AdminDashboard"),
  "AdminDashboard",
);
const AdminLauncher = LAUNCHER_ENABLED
  ? lazyNamed(() => import("./features/admin/AdminLauncher"), "AdminLauncher")
  : null;
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
const AdminGallery = lazyNamed(
  () => import("./features/admin/gallery/AdminGallery"),
  "AdminGallery",
);
const AdminPlanning = lazyNamed(
  () => import("./features/admin/planning/AdminPlanning"),
  "AdminPlanning",
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
const OwnerLauncherReleases = LAUNCHER_ENABLED
  ? lazyNamed(
      () => import("./features/admin/owner/OwnerLauncherReleases"),
      "OwnerLauncherReleases",
    )
  : null;
const OwnerLauncherPacks = LAUNCHER_ENABLED
  ? lazyNamed(
      () => import("./features/admin/owner/OwnerLauncherPacks"),
      "OwnerLauncherPacks",
    )
  : null;
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
const TitleGenerator = lazyNamed(
  () => import("./features/admin/tools/title-generator/TitleGenerator"),
  "TitleGenerator",
);
const AdminParties = lazyNamed(
  () => import("./features/admin/tools/parties/AdminParties"),
  "AdminParties",
);
const AdminVotes = lazyNamed(
  () => import("./features/admin/tools/votes/AdminVotes"),
  "AdminVotes",
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

const AdminChat = lazyNamed(() => import("./features/admin-chat"), "AdminChat");
const AdminChatProvider = lazy(() =>
  import("./contexts/admin-chat/AdminChatProvider").then((m) => ({
    default: m.AdminChatProvider,
  })),
);

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

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

function AppContent() {
  return (
    <Suspense fallback={<LoadingScreen text="Loading..." />}>
      <Routes>
        <Route path="/ad" element={<Advertisement />} />
        {AnnouncementTable && (
          <Route
            path="/dev/announcement-table"
            element={<AnnouncementTable />}
          />
        )}

        <Route path="/authorize" element={<Authorize />} />

        <Route path="/render/compare" element={<CompareRender />} />
        <Route path="/render/profile" element={<ProfileRender />} />
        <Route path="/render/activity" element={<ActivityRender />} />
        <Route path="/render/top" element={<TopRender />} />
        <Route path="/render/records" element={<RecordsRender />} />
        <Route path="/render/tag" element={<TagRender />} />

        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/team" element={<Team />} />
          <Route path="/leaderboards" element={<Leaderboards />} />
          <Route
            path="/leaderboards/compare"
            element={<LeaderboardsCompare />}
          />
          <Route path="/gallery" element={<Gallery />} />
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
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/team-tag"
            element={
              <ProtectedRoute promptLogin>
                <TeamTag />
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

          <Route path="/chat" element={<ChatRedirect />} />
          <Route path="/chat/:serverSlug" element={<ServerChat />} />

          <Route
            path="/admin/*"
            element={
              <ProtectedRoute requiresAdmin>
                <AdminPlayersProvider>
                  <ErrorBoundary>
                    <Routes>
                      <Route path="dashboard" element={<AdminDashboard />} />
                      <Route path="waitlist" element={<AdminWaitlists />} />
                      <Route path="players" element={<AdminPlayers />} />
                      <Route
                        path="players/:id"
                        element={<AdminPlayerDetail />}
                      />
                      <Route path="planning" element={<AdminPlanning />} />
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
                      <Route path="tools/gallery" element={<AdminGallery />} />
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
                        path="tools/command-docs"
                        element={<CommandDocs />}
                      />
                      <Route
                        path="tools/stat-search"
                        element={<StatSearch />}
                      />
                      <Route
                        path="tools/title-generator"
                        element={<TitleGenerator />}
                      />
                      <Route path="tools/parties" element={<AdminParties />} />
                      <Route path="tools/votes" element={<AdminVotes />} />
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
                      {AdminLauncher && (
                        <Route path="launcher" element={<AdminLauncher />} />
                      )}
                      <Route path="changelog" element={<Changelog />} />
                      <Route path="logs" element={<AdminLogs />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </ErrorBoundary>
                </AdminPlayersProvider>
              </ProtectedRoute>
            }
          />

          <Route
            path="/owner/*"
            element={
              <OwnerRoute>
                <ErrorBoundary>
                  <Routes>
                    <Route path="admins" element={<OwnerAdmins />} />
                    <Route path="donations" element={<OwnerDonations />} />
                    {OwnerLauncherReleases && (
                      <Route
                        path="launcher-releases"
                        element={<OwnerLauncherReleases />}
                      />
                    )}
                    {OwnerLauncherPacks && (
                      <Route
                        path="launcher-packs"
                        element={<OwnerLauncherPacks />}
                      />
                    )}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </ErrorBoundary>
              </OwnerRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WebSocketProvider>
          <ServerDataProvider>
            <PlayerDataProvider>
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
  );
}

export default App;
