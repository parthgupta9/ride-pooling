import 'dotenv/config';
import Redis from 'ioredis';

const client = new Redis({
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT)
});

client.on('connect', () => console.log('✓ Redis connected'));
client.on('error', (err) => console.log('✗ Redis Client Error', err));
client.on('reconnecting', () => console.log('Redis reconnecting...'));

export const redis = client;
