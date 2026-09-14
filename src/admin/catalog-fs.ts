export function rethrowIfReadonlyFs(err: unknown, filePath: string): never {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: unknown }).code)
      : "";
  if (code === "EROFS" || code === "EACCES") {
    throw new Error(
      `Cannot write catalog file (read-only filesystem): ${filePath}`
    );
  }
  throw err;
}
