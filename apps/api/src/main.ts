import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ConfigService } from "@nestjs/config";
import { AllExceptionsFilter } from "./common/http-exception.filter";
import express from "express";
import { ensureUploadsDir, UPLOADS_DIR } from "./common/uploads";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const origin = config.get<string>("WEB_ORIGIN") ?? "http://localhost:5173";

  const instance = app.getHttpAdapter().getInstance() as { set?: (key: string, value: unknown) => void };
  instance.set?.("trust proxy", 1);
  ensureUploadsDir();
  app.use("/uploads", express.static(UPLOADS_DIR));
  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: origin.split(",").map((s) => s.trim()),
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Outlet-Id"],
  });
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = Number(config.get("PORT") ?? 3001);
  const jwtSecret = config.get<string>("JWT_SECRET") ?? "change-me-to-a-long-random-string";
  if (process.env.NODE_ENV === "production" && jwtSecret === "change-me-to-a-long-random-string") {
    throw new Error("JWT_SECRET must be set to a strong secret in production");
  }
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}/api/v1`);
}

bootstrap();
