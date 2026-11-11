// Starts an in-memory MongoDB once for the whole test run.
import { MongoMemoryServer } from 'mongodb-memory-server';

let server: MongoMemoryServer;

export async function setup() {
  server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri('fooddash-test');
  process.env.AUTH_SECRET = 'test-secret-that-is-at-least-32-characters-long';
}

export async function teardown() {
  await server?.stop();
}
