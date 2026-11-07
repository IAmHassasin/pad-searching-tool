import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AdminSessionProvider } from "./hooks/useAdminSession";
import { DungeonDetailsPage } from "./dungeon-details/DungeonDetailsPage";
import { DungeonListPage } from "./dungeon-details/DungeonListPage";
import { EggMachinesPage } from "./egg-machines/EggMachinesPage";
import { EventDetailPage } from "./event/EventDetailPage";
import { EventListPage } from "./event/EventListPage";
import { OneTouchPage } from "./one-touch/OneTouchPage";
import { CustomCardPage } from "./custom-card/CustomCardPage";
import { TeamBuildPage } from "./team-build/TeamBuildPage";
import { TierMakerPage } from "./tier-maker/TierMakerPage";
import { AppUpdateLaunch } from "./components/AppUpdateLaunch";
import { MobileBottomNav } from "./components/MobileBottomNav";
import { MOBILE_NAV_BOTTOM_PADDING_CLASS } from "./components/MobileSheet";
import { useMobileWebview } from "./hooks/useMobileWebview";
import { TranslatePage } from "./translate/TranslatePage";
import { SupportLaunch } from "./components/SupportLaunch";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Mobile view: every page gets the fixed bottom nav; the page itself is
 * padded so fixed-height layouts (search, team build) and document-scrolling
 * pages alike end above it.
 */
function MobileShell({ children }: { children: ReactNode }) {
  const isMobile = useMobileWebview();
  if (!isMobile) return <>{children}</>;
  return (
    <>
      <div className={`h-full ${MOBILE_NAV_BOTTOM_PADDING_CLASS}`}>{children}</div>
      <MobileBottomNav />
    </>
  );
}

function Root() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const detailMatch = path.match(/^\/dungeon-details\/(\d+)$/);
  const eventDetailMatch = path.match(/^\/event\/([a-zA-Z0-9_-]+)$/);

  if (path === "/dungeon-details") {
    return <DungeonListPage />;
  }
  if (detailMatch) {
    return <DungeonDetailsPage postId={detailMatch[1]} />;
  }
  if (path === "/event") {
    return <EventListPage />;
  }
  if (path === "/egg-machines") {
    return <EggMachinesPage />;
  }
  if (eventDetailMatch) {
    return <EventDetailPage eventId={eventDetailMatch[1]} />;
  }
  if (path === "/one-touch") {
    return <OneTouchPage />;
  }
  if (path === "/custom-card") {
    return <CustomCardPage />;
  }
  if (path === "/team-build") {
    return <TeamBuildPage />;
  }
  if (path === "/tier-maker") {
    return <TierMakerPage />;
  }
  if (path === "/translate") {
    return <TranslatePage />;
  }
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AdminSessionProvider>
        <MobileShell>
          <Root />
        </MobileShell>
        <SupportLaunch />
        <AppUpdateLaunch />
      </AdminSessionProvider>
    </QueryClientProvider>
  </StrictMode>
);
