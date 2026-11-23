type Job = {
  id: string;
  name: string;
  run: () => Promise<void>;
};

/**
 * Lightweight in-process queue for work that should not block HTTP responses.
 * Swap for BullMQ/Redis when running multiple API instances.
 */
export class JobQueue {
  private readonly pending = new Map<string, Job>();
  private readonly queued: string[] = [];
  private active = 0;

  constructor(private readonly concurrency = 1) {}

  /** Enqueue by key; duplicate keys while pending are ignored. */
  enqueue(key: string, name: string, run: () => Promise<void>) {
    if (this.pending.has(key)) return { queued: false, key };
    this.pending.set(key, { id: key, name, run });
    this.queued.push(key);
    void this.pump();
    return { queued: true, key };
  }

  size() {
    return this.pending.size;
  }

  private async pump() {
    while (this.active < this.concurrency && this.queued.length) {
      const key = this.queued.shift();
      if (!key) return;
      const job = this.pending.get(key);
      if (!job) continue;
      this.active += 1;
      try {
        await job.run();
      } catch (error) {
        console.error(`[jobs] ${job.name} failed`, error);
      } finally {
        this.pending.delete(key);
        this.active -= 1;
        void this.pump();
      }
    }
  }
}

export const JOB_QUEUE = Symbol("JOB_QUEUE");
