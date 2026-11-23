import "reflect-metadata";
import { config } from "dotenv";
import { resolve } from "path";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

config({ path: resolve(__dirname, "../../../.env") });

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.useBodyParser("json", { limit: "2mb" });
  app.useBodyParser("urlencoded", { extended: true, limit: "2mb" });
  app.setGlobalPrefix("api");
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  });
  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
}

bootstrap();
