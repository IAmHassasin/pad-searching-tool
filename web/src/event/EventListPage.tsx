import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminDeleteEvent } from "../api";
import { AdminLaunch } from "../components/AdminLaunch";
import { CatalogDeleteButton } from "../components/CatalogDeleteButton";
import { PageHeader } from "../components/PageHeader";
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
    <div className="min-h-full bg-[var(--color-surface)] text-[var(--color-fg)]">
      <PageHeader
        title="Events"
        subtitle="New monster & evolution announcements"
        actions={<AdminLaunch variant="chip" />}
        maxWidthClass="max-w-5xl"
      />

      <main className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
        {list.isLoading && (
          <p className="text-sm text-[var(--color-muted)]">Loading…</p>
        )}
        {list.isError && (
          <p className="text-sm text-[var(--color-negative)]">
            {list.error instanceof Error ? list.error.message : "Failed to load"}
          </p>
        )}
        {list.data && list.data.events.length === 0 && (
          <p className="text-sm text-[var(--color-muted)]">No events yet.</p>
        )}
        <ul className="space-y-2">
          {list.data?.events.map((e) => (
            <li
              key={e.eventId}
              className="ds-card flex items-stretch overflow-hidden transition-colors duration-150 hover:border-white/10 hover:bg-[var(--color-hover)]"
            >
              <a
                href={`/event/${e.eventId}`}
                className="pressable min-w-0 flex-1 px-4 py-3"
              >
                <div className="font-semibold text-[var(--color-fg-strong)]">
                  {e.title}
                </div>
                {e.subtitle && (
                  <div className="mt-1 text-sm text-[var(--color-muted)]">
                    {e.subtitle}
                  </div>
                )}
                {e.publishedAt && (
                  <div className="mt-1 font-mono text-xs text-[var(--color-faint)]">
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
