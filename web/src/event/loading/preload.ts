/** Prefetch images; resolves when all settle (ok or error). */
export function preloadImageUrls(urls: string[]): Promise<void> {
  const unique = [...new Set(urls.filter(Boolean))];
  if (!unique.length) return Promise.resolve();

  return Promise.all(
    unique.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = url;
        })
    )
  ).then(() => undefined);
}
