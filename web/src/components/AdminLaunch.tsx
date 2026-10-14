import { useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AdminPanel } from "./AdminPanel";
import { useAdminSession } from "../hooks/useAdminSession";

function invalidateCatalogs(
  queryClient: ReturnType<typeof useQueryClient>
) {
  void queryClient.invalidateQueries({ queryKey: ["monsters", "search"] });
  void queryClient.invalidateQueries({ queryKey: ["events"] });
  void queryClient.invalidateQueries({ queryKey: ["dungeon-details"] });
}

type Props = {
  /** `chip` matches the Search page status bar; `header` sits next to tool nav. */
  variant?: "chip" | "header";
  compact?: boolean;
};

export function AdminLaunch({ variant = "header", compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const admin = useAdminSession();
  const queryClient = useQueryClient();

  if (!admin.adminEnabled) return null;

  const buttonClass =
    variant === "chip"
      ? "pressable shrink-0 rounded-full border border-[var(--color-accent)]/40 bg-[var(--color-accent-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-accent-strong)] hover:border-[var(--color-accent)]"
      : "pressable shrink-0 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--color-accent-strong)] hover:border-[var(--color-accent)]";

  const label = admin.isSuperadmin
    ? "Admin"
    : compact
      ? "Login"
      : "Admin login";

  return (
    <>
      <button type="button" className={buttonClass} onClick={() => setOpen(true)}>
        {label}
      </button>
      {/* Portal out of the launcher's host: app bars use backdrop-filter,
          which would otherwise become the containing block of the fixed modal. */}
      {createPortal(
        <AdminPanel
          variant="modal"
          open={open}
          onClose={() => setOpen(false)}
          adminEnabled={admin.adminEnabled}
          isSuperadmin={admin.isSuperadmin}
          checking={admin.checking}
          username={admin.username}
          token={admin.token}
          onLogin={async (u, p) => {
            await admin.login(u, p);
          }}
          onLogout={admin.logout}
          onRefreshComplete={() => invalidateCatalogs(queryClient)}
        />,
        document.body
      )}
    </>
  );
}
