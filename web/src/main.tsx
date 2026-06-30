import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { DungeonDetailsPage } from "./dungeon-details/DungeonDetailsPage";
import { DungeonListPage } from "./dungeon-details/DungeonListPage";
import { OneTouchPage } from "./one-touch/OneTouchPage";
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

  if (path === "/dungeon-details") {
    return <DungeonListPage />;
  }
  if (detailMatch) {
    return <DungeonDetailsPage postId={detailMatch[1]} />;
  }
  if (path === "/one-touch") {
    return <OneTouchPage />;
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
