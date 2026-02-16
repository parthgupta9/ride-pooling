import { createClient } from 'redis';

const client = createClient({
  username: process.env.REDIS_USERNAME || 'default',
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
});

client.on('error', (err) => console.log('Redis Client Error', err));

await client.connect();

export const redis = client;
