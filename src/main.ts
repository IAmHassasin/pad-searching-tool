import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { setupWebStatic } from "./setup-web-static";
import { TransformService } from "./transform/transform.service";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const startHttp = process.env.START_HTTP === "true";
  const runTransform = process.env.RUN_TRANSFORM !== "false";

  if (!startHttp) {
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ["error", "warn", "log"],
    });
    try {
      if (runTransform) {
        await app.get(TransformService).run();
        logger.log("Transform finished.");
      }
    } finally {
      await app.close();
    }
    return;
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ["error", "warn", "log"],
  });

  app.enableCors({ origin: true });

  if (runTransform) {
    await app.get(TransformService).run();
    logger.log("Transform finished.");
  }

  await app.init();
  setupWebStatic(app, logger);

  const port = Number(process.env.HTTP_PORT ?? "3000");
  const host = process.env.HTTP_HOST ?? "0.0.0.0";
  await app.listen(port, host);
  logger.log(`HTTP listening on http://${host}:${port}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
