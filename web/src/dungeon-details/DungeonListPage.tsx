import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminDeleteDungeon } from "../api";
import { AdminLaunch } from "../components/AdminLaunch";
import { CatalogDeleteButton } from "../components/CatalogDeleteButton";
import { PageHeader } from "../components/PageHeader";
import { useAdminSession } from "../hooks/useAdminSession";
import { fetchDungeonList } from "./api";

export function DungeonListPage() {
  const list = useQuery({
    queryKey: ["dungeon-details", "list"],
    queryFn: fetchDungeonList,
  });
  const admin = useAdminSession();
  const queryClient = useQueryClient();

  return (
    <div className="min-h-full bg-[var(--color-surface)] text-[var(--color-fg)]">
      <PageHeader
        title="Dungeon details"
        subtitle="Floor tables parsed from AppMedia (English UI)"
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
        {list.data && list.data.dungeons.length === 0 && (
          <p className="text-sm text-[var(--color-muted)]">
            No dungeons yet. Run{" "}
            <code className="rounded bg-[var(--color-inset)] px-1.5 py-0.5 font-mono text-xs text-[var(--color-accent-strong)]">
              make dungeon-import
            </code>{" "}
            then restart Docker.
          </p>
        )}
        <ul className="space-y-2">
          {list.data?.dungeons.map((d) => {
            const title = d.titleEn ?? d.titleJa.replace(/^【パズドラ】/, "");
            const imported = d.importedAt?.slice(0, 10);
            return (
              <li
                key={d.appmediaPostId}
                className="ds-card flex items-stretch overflow-hidden transition-colors duration-150 hover:border-white/10 hover:bg-[var(--color-hover)]"
              >
                <a
                  href={`/dungeon-details/${d.appmediaPostId}`}
                  className="pressable min-w-0 flex-1 px-4 py-3"
                >
                  <div className="font-semibold text-[var(--color-fg-strong)]">
                    {title}
                  </div>
                  <div className="mt-1 font-mono text-xs text-[var(--color-muted)]">
                    #{d.appmediaPostId}
                    {imported ? ` · ${imported}` : ""}
                  </div>
                </a>
                {admin.isSuperadmin && admin.token && (
                  <CatalogDeleteButton
                    label={title}
                    onDelete={async () => {
                      await adminDeleteDungeon(admin.token!, d.appmediaPostId);
                      await queryClient.invalidateQueries({
                        queryKey: ["dungeon-details"],
                      });
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
