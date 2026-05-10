import Database from "better-sqlite3";
import { join } from "path";

const file = join(process.cwd(), "test.db");
const db = new Database(file);
db.exec(`
  DROP TABLE IF EXISTS monsters;
  CREATE TABLE monsters (id INTEGER PRIMARY KEY, name TEXT);
  INSERT INTO monsters (id, name) VALUES (1, 'alpha'), (2, 'error_sample');
`);
db.close();
console.log("wrote", file);
