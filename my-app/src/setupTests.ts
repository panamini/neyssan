// src/setupTests.ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Set the environment variable for the backend URL
vi.stubEnv('VITE_PDF_INGEST_URL', 'http://localhost:8000');

// Mock the global alert function to prevent it from appearing during tests
vi.stubGlobal('alert', vi.fn());
