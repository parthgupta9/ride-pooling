import { redis } from "../config/redis.js";

const QUEUE = "ride:queue";

export async function enqueueRide(data) {
  await redis.rpush(QUEUE, JSON.stringify(data));
}

export async function dequeueBatch(size = 5) {
  const pipeline = redis.pipeline();
  for (let i = 0; i < size; i++) {
    pipeline.lpop(QUEUE);
  }
  const result = await pipeline.exec();
  return result.map(r => r[1]).filter(Boolean).map(JSON.parse);
}
