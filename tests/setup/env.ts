import { afterAll, vi } from 'vitest';
import mongoose from 'mongoose';

// No network in tests: Open-Meteo calls fall back to the seasonal estimate.
vi.stubGlobal('fetch', () => Promise.reject(new Error('network disabled in tests')));

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  }
});
