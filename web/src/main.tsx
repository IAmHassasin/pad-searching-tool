import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { DungeonDetailsPage } from "./dungeon-details/DungeonDetailsPage";
import { DungeonListPage } from "./dungeon-details/DungeonListPage";
import { EventDetailPage } from "./event/EventDetailPage";
import { EventListPage } from "./event/EventListPage";
import { OneTouchPage } from "./one-touch/OneTouchPage";
import { TeamBuildPage } from "./team-build/TeamBuildPage";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

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
  if (eventDetailMatch) {
    return <EventDetailPage eventId={eventDetailMatch[1]} />;
  }
  if (path === "/one-touch") {
    return <OneTouchPage />;
  }
  if (path === "/team-build") {
    return <TeamBuildPage />;
  }
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Root />
    </QueryClientProvider>
  </StrictMode>
);
