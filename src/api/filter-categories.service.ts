import { Injectable, NotFoundException } from "@nestjs/common";
import * as fs from "node:fs";
import * as path from "node:path";
import type { FilterTypeCategoriesFile } from "../transform/filter-type-categories";

@Injectable()
export class FilterCategoriesService {
  resolveConfigPath(): string {
    const fromEnv = process.env.FILTER_TYPE_CATEGORIES_PATH?.trim();
    if (fromEnv) {
      return path.isAbsolute(fromEnv)
        ? fromEnv
        : path.join(process.cwd(), fromEnv);
    }
    return path.join(process.cwd(), "docs", "filter-type-categories.json");
  }

  readManifest(): FilterTypeCategoriesFile {
    const filePath = this.resolveConfigPath();
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(
        `Filter categories file not found: ${filePath}`
      );
    }
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as FilterTypeCategoriesFile;
      if (!parsed?.categories?.length) {
        throw new Error("empty");
      }
      return parsed;
    } catch {
      throw new NotFoundException("Invalid filter-type-categories.json");
    }
  }
}
