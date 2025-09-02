// src/setupTests.ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Set the environment variable for the backend URL
vi.stubEnv('VITE_PDF_INGEST_URL', 'http://localhost:8000');

// Mock the global alert function to prevent it from appearing during tests
vi.stubGlobal('alert', vi.fn());
// Ensure Convex React tests don't fail when test files partially mock the library.
// Provide a safe default for useAction so components that import it won't throw.
vi.mock('convex/react', async (importOriginal) => {
  const actualAny: any = await importOriginal();
  return {
    ...(actualAny || {}),
    useAction: (actualAny && actualAny.useAction) ? actualAny.useAction : (() => undefined),
  };
});
