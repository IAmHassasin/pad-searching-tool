import { useQuery } from "@tanstack/react-query";
import { fetchDungeonList } from "./api";

export function DungeonListPage() {
  const list = useQuery({
    queryKey: ["dungeon-details", "list"],
    queryFn: fetchDungeonList,
  });

  return (
    <div className="min-h-full bg-[var(--color-surface)] text-[#e6edf3]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Dungeon details</h1>
            <p className="text-sm text-[var(--color-muted)]">
              Floor tables parsed from AppMedia (English UI)
            </p>
          </div>
          <a
            href="/"
            className="text-sm text-[var(--color-accent)] hover:underline"
          >
            ← Monster search
          </a>
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
            return (
              <li key={d.appmediaPostId}>
                <a
                  href={`/dungeon-details/${d.appmediaPostId}`}
                  className="block rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3 hover:border-[var(--color-accent)]"
                >
                  <div className="font-medium" title={d.titleJa}>
                    {title}
                  </div>
                  <div className="mt-1 text-xs text-[var(--color-muted)]">
                    #{d.appmediaPostId} · imported {d.importedAt.slice(0, 10)}
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
