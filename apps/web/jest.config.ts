import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // Path to your Next.js app
  dir: './',
});

const config: Config = {
  displayName: 'web',
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/src/**/*.spec.{ts,tsx}'],
  coverageDirectory: 'coverage',
};

export default createJestConfig(config);
