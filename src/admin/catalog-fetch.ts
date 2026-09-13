export const CATALOG_USER_AGENT = "pad-searching-tool/catalog-sync";

export async function fetchCatalogText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": CATALOG_USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`Fetch ${url} failed: ${res.status} ${res.statusText}`);
  }
  return res.text();
}
