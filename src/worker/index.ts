/**
 * Agency OS — Background Worker
 *
 * This process connects to Redis and processes async jobs from BullMQ.
 * It runs independently from the Next.js web app.
 *
 * To run locally: npm run worker:dev
 * In production: runs as a separate Docker container
 */
import { Worker, type Job } from "bullmq";
import { type JobName, type JobData } from "@/lib/queue";
import { processAgentBriefing } from "./jobs/agent-briefing";
import { processInvoiceReminder } from "./jobs/invoice-reminder";
import { processGitHubSync } from "./jobs/github-sync";

const QUEUE_NAME = "agency-jobs";

function getRedisConnection() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");

  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
  };
}

// ─── Job router ───────────────────────────────────────────────────────────────

async function processJob(job: Job<JobData, unknown, JobName>) {
  console.log(`[worker] Processing job: ${job.name} (id=${job.id})`);

  switch (job.name) {
    case "agent:generate-briefing":
      return processAgentBriefing(job.data as Parameters<typeof processAgentBriefing>[0]);

    case "invoice:send-reminder":
      return processInvoiceReminder(job.data as Parameters<typeof processInvoiceReminder>[0]);

    case "github:sync-repo":
      return processGitHubSync(job.data as Parameters<typeof processGitHubSync>[0]);

    case "email:ingest":
      // Future: email parsing implementation
      console.log("[worker] email:ingest job received — not yet implemented");
      return { skipped: true };

    default:
      console.warn(`[worker] Unknown job name: ${(job as Job).name}`);
      return null;
  }
}

// ─── Worker startup ───────────────────────────────────────────────────────────

function startWorker() {
  const connection = getRedisConnection();

  const worker = new Worker<JobData, unknown, JobName>(
    QUEUE_NAME,
    processJob,
    {
      connection,
      concurrency: 5, // process up to 5 jobs in parallel
      limiter: {
        max: 10,
        duration: 1000, // max 10 jobs per second
      },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[worker] ✓ Job completed: ${job.name} (id=${job.id})`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[worker] ✗ Job failed: ${job?.name ?? "unknown"} (id=${job?.id}) — ${err.message}`
    );
  });

  worker.on("error", (err) => {
    console.error("[worker] Worker error:", err.message);
  });

  console.log(`[worker] Started — listening on queue "${QUEUE_NAME}"`);
  console.log(`[worker] Redis: ${process.env.REDIS_URL?.replace(/:([^@]+)@/, ":*****@") ?? "not set"}`);
  console.log(`[worker] DB: ${process.env.DATABASE_URL?.replace(/:([^@]+)@/, ":*****@") ?? "not set"}`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log("[worker] Shutting down gracefully...");
    await worker.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startWorker();
