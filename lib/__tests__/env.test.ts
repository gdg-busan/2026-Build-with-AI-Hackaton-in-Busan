import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

describe('Environment Configuration', () => {
  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  const envExamplePath = path.resolve(process.cwd(), '.env.local.example');

  it('should have all keys from .env.local.example present in .env.local', () => {
    // Check files exist
    expect(fs.existsSync(envLocalPath)).toBe(true);
    expect(fs.existsSync(envExamplePath)).toBe(true);

    const localConfig = dotenv.parse(fs.readFileSync(envLocalPath));
    const exampleConfig = dotenv.parse(fs.readFileSync(envExamplePath));

    const exampleKeys = Object.keys(exampleConfig).filter(key => key !== '');
    const localKeys = Object.keys(localConfig);

    const missingKeys = exampleKeys.filter(key => !localKeys.includes(key));

    // Special handling for FIREBASE_PRIVATE_KEY format if needed
    // But this test ensures they are defined.
    // If example has empty value, it still counts as a key.

    if (missingKeys.length > 0) {
      console.warn(`Missing keys in .env.local: ${missingKeys.join(', ')}`);
    }

    expect(missingKeys).toEqual([]);
  });

  it('should have valid FIREBASE_PRIVATE_KEY format', () => {
    const localConfig = dotenv.parse(fs.readFileSync(envLocalPath));
    const privateKey = localConfig.FIREBASE_PRIVATE_KEY;

    expect(privateKey).toBeDefined();
    // A private key should start with the header
    // In .env, it might be wrapped in quotes and contain \n literals
    // Let's handle common cases
    const unescapedKey = privateKey.replace(/\\n/g, '\n');
    expect(unescapedKey).toContain('-----BEGIN PRIVATE KEY-----');
    expect(unescapedKey).toContain('-----END PRIVATE KEY-----');
  });
});
