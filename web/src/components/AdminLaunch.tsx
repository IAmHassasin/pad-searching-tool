import { useState } from "react";
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
};

export function AdminLaunch({ variant = "header" }: Props) {
  const [open, setOpen] = useState(false);
  const admin = useAdminSession();
  const queryClient = useQueryClient();

  if (!admin.adminEnabled) return null;

  const buttonClass =
    variant === "chip"
      ? "rounded border border-amber-700/80 px-2 py-0.5 text-xs text-amber-200 hover:border-amber-500 hover:text-amber-100"
      : "rounded border border-amber-700/80 bg-amber-950/40 px-2.5 py-1 text-xs font-medium text-amber-200 hover:border-amber-500 hover:text-amber-50";

  return (
    <>
      <button type="button" className={buttonClass} onClick={() => setOpen(true)}>
        {admin.isSuperadmin ? "Admin" : "Admin login"}
      </button>
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
      />
    </>
  );
}
