export const API_PREFIXES = [
  "/health",
  "/source-records",
  "/category-bundles",
  "/filter-categories",
  "/patterns",
  "/monsters",
  "/admin",
  "/pad-categorized",
  "/awoken-skills",
  "/api",
];

export function isApiPath(path: string): boolean {
  return API_PREFIXES.some(
    (p) => path === p || path.startsWith(`${p}/`)
  );
}
