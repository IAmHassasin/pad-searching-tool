import { useState } from "react";
import { APP_TOOLS, currentAppPath, isAppToolActive } from "../lib/app-tools";
import { splitMobileNavTools } from "../lib/mobile-nav";
import { AdminLaunch } from "./AdminLaunch";
import { MOBILE_NAV_HEIGHT_CLASS, MobileSheet } from "./MobileSheet";

const { primary: PRIMARY_TOOLS, others: OTHER_TOOLS } =
  splitMobileNavTools(APP_TOOLS);

function NavIcon({
  imageUrl,
  icon,
  active,
}: {
  imageUrl?: string;
  icon?: string;
  active: boolean;
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        width={20}
        height={20}
        className={`rounded-full ${active ? "ring-1 ring-[var(--color-accent)]/60" : "opacity-80"}`}
        aria-hidden
      />
    );
  }
  return (
    <span aria-hidden className="text-base leading-none">
      {icon}
    </span>
  );
}

const NAV_ITEM_CLASS =
  "pressable relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold leading-none";

function navTone(active: boolean): string {
  return active
    ? "text-[var(--color-accent-strong)]"
    : "text-[var(--color-muted)] hover:text-[var(--color-fg-strong)]";
}

/**
 * Mobile bottom navigation shown on every page: Monsters · Teams · Dungeons
 * pinned, everything else (and the Admin launcher) behind "Others".
 */
export function MobileBottomNav() {
  const [othersOpen, setOthersOpen] = useState(false);
  const current = currentAppPath();
  const othersActive = OTHER_TOOLS.some((tool) =>
    isAppToolActive(tool.href, current)
  );

  return (
    <>
      <MobileSheet
        open={othersOpen}
        onClose={() => setOthersOpen(false)}
        label="Other tools"
        title="Others"
      >
        <nav
          aria-label="Other tools"
          className="min-h-0 flex-1 overflow-y-auto px-3 py-2"
        >
          <ul className="space-y-1">
            {OTHER_TOOLS.map((tool) => {
              const active = isAppToolActive(tool.href, current);
              return (
                <li key={tool.href}>
                  <a
                    href={tool.href}
                    aria-current={active ? "page" : undefined}
                    className={`pressable flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 ${
                      active
                        ? "border-[var(--color-accent)]/60 bg-[var(--color-accent-muted)]"
                        : "border-[var(--color-border)] bg-[var(--color-panel)] hover:border-[var(--color-border-strong)]"
                    }`}
                  >
                    <NavIcon
                      imageUrl={tool.imageUrl}
                      icon={tool.icon}
                      active={active}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-sm font-semibold ${
                          active
                            ? "text-[var(--color-accent-strong)]"
                            : "text-[var(--color-fg-strong)]"
                        }`}
                      >
                        {tool.navLabel}
                      </span>
                      <span className="block truncate text-[11px] text-[var(--color-muted)]">
                        {tool.description}
                      </span>
                    </span>
                    <span aria-hidden className="text-[var(--color-faint)]">
                      ›
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3">
            <span className="ds-label">Admin</span>
            <AdminLaunch variant="header" />
          </div>
        </nav>
      </MobileSheet>

      <nav
        aria-label="Main"
        className="glass-bar fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] pb-[env(safe-area-inset-bottom)]"
      >
        <div className={`grid grid-cols-4 gap-0.5 px-2 py-1 ${MOBILE_NAV_HEIGHT_CLASS}`}>
          {PRIMARY_TOOLS.map((tool) => {
            const active = isAppToolActive(tool.href, current);
            return (
              <a
                key={tool.href}
                href={tool.href}
                title={tool.description}
                aria-current={active ? "page" : undefined}
                className={`${NAV_ITEM_CLASS} ${navTone(active)} ${
                  active ? "bg-[var(--color-accent-muted)]" : "hover:bg-white/5"
                }`}
              >
                <NavIcon
                  imageUrl={tool.imageUrl}
                  icon={tool.icon}
                  active={active}
                />
                <span>{tool.navLabel}</span>
              </a>
            );
          })}
          <button
            type="button"
            onClick={() => setOthersOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={othersOpen}
            className={`${NAV_ITEM_CLASS} ${navTone(othersActive || othersOpen)} ${
              othersActive || othersOpen
                ? "bg-[var(--color-accent-muted)]"
                : "hover:bg-white/5"
            }`}
          >
            <span aria-hidden className="text-base leading-none">
              ⋯
            </span>
            <span>Others</span>
          </button>
        </div>
      </nav>
    </>
  );
}
