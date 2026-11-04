import type { ReactNode } from "react";
import { QuickSearchSidebar } from "./QuickSearchSidebar";

/**
 * Page body with the quick-search sidebar docked on the left. Must be rendered
 * inside `QuickSearchProvider`; the page header stays above (outside) it.
 */
export function QuickSearchLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <QuickSearchSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
