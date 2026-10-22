import { z } from 'zod';

export const defaultAlgorithmParameters = {
  valenceBase: 0.75,
  valenceSalience: 0.25,
  reviewStrengthWeight: 0.7,
  reviewAgeWeight: 0.3,
  reviewAgeCapDays: 90,
} as const;

export const algorithmParametersSchema = z.object({
  valenceBase: z.number().finite().min(0).max(1),
  valenceSalience: z.number().finite().min(0).max(1),
  reviewStrengthWeight: z.number().finite().min(0).max(1),
  reviewAgeWeight: z.number().finite().min(0).max(1),
  reviewAgeCapDays: z.number().int().min(1).max(3650),
}).refine(v => Math.abs(v.valenceBase + v.valenceSalience - 1) < 1e-9, {
  message: 'Valence base and salience coefficients must sum to 1',
  path: ['valenceSalience'],
}).refine(v => Math.abs(v.reviewStrengthWeight + v.reviewAgeWeight - 1) < 1e-9, {
  message: 'Review strength and age weights must sum to 1',
  path: ['reviewAgeWeight'],
});

export type AlgorithmParameters = z.infer<typeof algorithmParametersSchema>;
