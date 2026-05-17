import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import * as fs from "node:fs";
import * as path from "node:path";
import type {
  CategoryBundleFile,
  CategoryBundleIndex,
} from "../transform/category-json-export";

const SAFE_BUNDLE_FILE = /^[a-zA-Z0-9._+-]+\.json$/;

@Injectable()
export class CategoryBundlesService {
  resolveExportDir(): string {
    const fromEnv = process.env.CATEGORY_JSON_EXPORT_DIR?.trim();
    if (!fromEnv) {
      throw new ServiceUnavailableException(
        "CATEGORY_JSON_EXPORT_DIR is not set. Run transform with export enabled."
      );
    }
    return path.isAbsolute(fromEnv)
      ? fromEnv
      : path.join(process.cwd(), fromEnv);
  }

  readIndex(): CategoryBundleIndex {
    const dir = this.resolveExportDir();
    const indexPath = path.join(dir, "index.json");
    if (!fs.existsSync(indexPath)) {
      throw new NotFoundException(
        `Category bundle index not found at ${indexPath}. Run npm run pad -- transform.`
      );
    }
    try {
      const raw = fs.readFileSync(indexPath, "utf8");
      return JSON.parse(raw) as CategoryBundleIndex;
    } catch {
      throw new NotFoundException("Invalid category bundle index.json");
    }
  }

  readBundle(filename: string): CategoryBundleFile {
    const name = filename.trim();
    if (!SAFE_BUNDLE_FILE.test(name) || name.includes("..")) {
      throw new BadRequestException("Invalid bundle file name");
    }
    const dir = this.resolveExportDir();
    const filePath = path.join(dir, name);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Bundle not found: ${name}`);
    }
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      return JSON.parse(raw) as CategoryBundleFile;
    } catch {
      throw new NotFoundException(`Invalid bundle file: ${name}`);
    }
  }
}
