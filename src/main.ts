import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";
import { TransformService } from "./transform/transform.service";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });

  try {
    const transform = app.get(TransformService);
    await transform.run();
    logger.log("Transform finished.");
  } finally {
    await app.close();
  }
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
