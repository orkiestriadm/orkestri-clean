import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly client: Redis;
  private available = false;

  constructor(private config: ConfigService) {
    this.client = new Redis({
      host:     config.get("REDIS_HOST", "redis"),
      port:     config.get<number>("REDIS_PORT", 6379),
      password: config.get("REDIS_PASSWORD", ""),
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 500, 10000),
      enableOfflineQueue: false,
    });

    this.client.on("connect", () => {
      this.available = true;
      this.logger.log("Redis conectado");
    });
    this.client.on("error", (e) => {
      this.available = false;
      this.logger.warn("Redis indisponível: " + e.message);
    });

    this.client.connect().catch(() => {});
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.available) return null;
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    if (!this.available) return;
    try {
      await this.client.setex(key, ttlSeconds, JSON.stringify(value));
    } catch {}
  }

  async del(...keys: string[]): Promise<void> {
    if (!this.available || keys.length === 0) return;
    try {
      await this.client.del(...keys);
    } catch {}
  }

  async delPattern(pattern: string): Promise<void> {
    if (!this.available) return;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) await this.client.del(...keys);
    } catch {}
  }

  /** Atomic increment with sliding-window expiry. Returns current count (0 = Redis down). */
  async rateLimitIncr(key: string, windowSeconds: number): Promise<number> {
    if (!this.available) return 0;
    try {
      const count = await this.client.incr(key);
      if (count === 1) await this.client.expire(key, windowSeconds);
      return count;
    } catch {
      return 0;
    }
  }

  /** Returns remaining TTL in seconds (-2 = key missing, -1 = no expiry, 0 = Redis down). */
  async ttl(key: string): Promise<number> {
    if (!this.available) return 0;
    try { return await this.client.ttl(key); } catch { return 0; }
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
