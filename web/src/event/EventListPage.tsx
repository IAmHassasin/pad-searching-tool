import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminDeleteEvent } from "../api";
import { AdminLaunch } from "../components/AdminLaunch";
import { AppToolsNav } from "../components/AppToolsNav";
import { CatalogDeleteButton } from "../components/CatalogDeleteButton";
import { useAdminSession } from "../hooks/useAdminSession";
import { fetchEventList } from "./api";

export function EventListPage() {
  const list = useQuery({
    queryKey: ["events", "list"],
    queryFn: fetchEventList,
  });
  const admin = useAdminSession();
  const queryClient = useQueryClient();

  return (
    <div className="min-h-full bg-[var(--color-surface)] text-[#e6edf3]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Events</h1>
            <p className="text-sm text-[var(--color-muted)]">
              New monster & evolution announcements
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AppToolsNav variant="inline" />
            <AdminLaunch variant="chip" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {list.isLoading && (
          <p className="text-[var(--color-muted)]">Loading…</p>
        )}
        {list.isError && (
          <p className="text-red-400">
            {list.error instanceof Error ? list.error.message : "Failed to load"}
          </p>
        )}
        {list.data && list.data.events.length === 0 && (
          <p className="text-[var(--color-muted)]">No events yet.</p>
        )}
        <ul className="space-y-2">
          {list.data?.events.map((e) => (
            <li
              key={e.eventId}
              className="flex items-stretch overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]"
            >
              <a
                href={`/event/${e.eventId}`}
                className="min-w-0 flex-1 px-4 py-3 hover:bg-white/5"
              >
                <div className="font-medium">{e.title}</div>
                {e.subtitle && (
                  <div className="mt-1 text-sm text-[var(--color-muted)]">
                    {e.subtitle}
                  </div>
                )}
                {e.publishedAt && (
                  <div className="mt-1 text-xs text-[var(--color-muted)]">
                    {e.publishedAt}
                  </div>
                )}
              </a>
              {admin.isSuperadmin && admin.token && (
                <CatalogDeleteButton
                  label={e.title}
                  onDelete={async () => {
                    await adminDeleteEvent(admin.token!, e.eventId);
                    await queryClient.invalidateQueries({ queryKey: ["events"] });
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
