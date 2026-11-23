type Entry<T> = { value: T; expiresAt: number };

export class TtlCache<T> {
  private readonly store = new Map<string, Entry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 2_000,
  ) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T) {
    this.prune();
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string) {
    this.store.delete(key);
  }

  deletePrefix(prefix: string) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  private prune(now = Date.now()) {
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) this.store.delete(key);
    }
    if (this.store.size <= this.maxEntries) return;
    const overflow = this.store.size - this.maxEntries;
    let removed = 0;
    for (const key of this.store.keys()) {
      this.store.delete(key);
      removed += 1;
      if (removed >= overflow) break;
    }
  }
}
