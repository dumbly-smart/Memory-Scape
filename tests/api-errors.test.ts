import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { jsonError } from '../lib/api';

describe('API validation error contract', () => {
  it('keeps flattened field and form errors stable with Zod 4', async () => {
    const schema = z.object({ title: z.string().min(1) });
    const result = schema.safeParse({ title: 4 });
    if (result.success) throw new Error('Fixture should fail schema validation');

    const response = jsonError(result.error);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Invalid request',
      details: { formErrors: [], fieldErrors: { title: expect.any(Array) } },
    });
  });
});
