import { HttpException, HttpStatus } from "@nestjs/common";
import type { Request } from "express";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** In-memory fixed window. Swap for Redis when running multiple API instances. */
export function assertRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || cur.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (cur.count >= limit) {
    throw new HttpException("Too many requests. Try again shortly.", HttpStatus.TOO_MANY_REQUESTS);
  }
  cur.count += 1;
}

export function clientIp(request: Request) {
  const xf = request.headers["x-forwarded-for"];
  const first = Array.isArray(xf) ? xf[0] : typeof xf === "string" ? xf.split(",")[0]?.trim() : "";
  return first || request.ip || request.socket?.remoteAddress || "unknown";
}
