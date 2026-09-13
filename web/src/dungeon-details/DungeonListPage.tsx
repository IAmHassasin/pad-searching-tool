import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminDeleteDungeon } from "../api";
import { AdminLaunch } from "../components/AdminLaunch";
import { AppToolsNav } from "../components/AppToolsNav";
import { CatalogDeleteButton } from "../components/CatalogDeleteButton";
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
    <div className="min-h-full bg-[var(--color-surface)] text-[#e6edf3]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Dungeon details</h1>
            <p className="text-sm text-[var(--color-muted)]">
              Floor tables parsed from AppMedia (English UI)
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
        {list.data && list.data.dungeons.length === 0 && (
          <p className="text-[var(--color-muted)]">
            No dungeons yet. Run{" "}
            <code className="rounded bg-[var(--color-panel)] px-1.5 py-0.5 text-xs">
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
                className="flex items-stretch overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]"
              >
                <a
                  href={`/dungeon-details/${d.appmediaPostId}`}
                  className="min-w-0 flex-1 px-4 py-3 hover:bg-white/5"
                >
                  <div className="font-medium">{title}</div>
                  <div className="mt-1 text-xs text-[var(--color-muted)]">
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
