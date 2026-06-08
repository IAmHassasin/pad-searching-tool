/**
 * CLI: download community PAD SQLite and merge into the working DB.
 */
import { runCommunityDbImport } from "./import/import-external-db.core";

async function main(): Promise<void> {
  const result = await runCommunityDbImport();
  console.log(`Import finished (${result.mode}). Working DB: ${result.sqlitePath}`);
  if (result.tablesReplaced.length) {
    console.log(`Replaced: ${result.tablesReplaced.join(", ")}`);
  }
  if (result.tablesCreated.length) {
    console.log(`Created: ${result.tablesCreated.join(", ")}`);
  }
  if (result.mode === "merge") {
    console.log(
      "Next: run transform if you still use pad_categorized exports."
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
