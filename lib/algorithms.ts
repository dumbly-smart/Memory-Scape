export function decayStrength(strength: number, decayRate: number, elapsedDays: number): number {
  if (![strength, decayRate, elapsedDays].every(Number.isFinite)) throw new TypeError('Algorithm inputs must be finite numbers');
  if (strength < 0 || strength > 1 || decayRate < 0) throw new RangeError('Strength must be in [0,1] and decay rate nonnegative');
  return Math.max(0, Math.min(1, strength * Math.exp(-decayRate * Math.max(0, elapsedDays))));
}

export function reinforceStrength(strength: number, factor: number): number {
  if (![strength, factor].every(Number.isFinite)) throw new TypeError('Algorithm inputs must be finite numbers');
  if (strength < 0 || strength > 1 || factor < 0 || factor > 1) throw new RangeError('Strength and factor must be in [0,1]');
  return Math.min(1, strength + factor * (1 - strength));
}
