import {
  BadRequestException,
  Controller,
  Get,
  Query,
} from "@nestjs/common";
import { CategoryBundlesService } from "./category-bundles.service";

@Controller("category-bundles")
export class CategoryBundlesController {
  constructor(private readonly categoryBundles: CategoryBundlesService) {}

  @Get("index")
  index() {
    return this.categoryBundles.readIndex();
  }

  @Get("file")
  file(@Query("name") name?: string) {
    if (!name?.trim()) {
      throw new BadRequestException('Query param "name" is required');
    }
    return this.categoryBundles.readBundle(name);
  }
}
