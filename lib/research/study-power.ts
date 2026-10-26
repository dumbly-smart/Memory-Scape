const MAX_PARTICIPANTS = 2_000;

export type McNemarAssumptions = {
  memoryscapeOnly: number;
  conventionalOnly: number;
};

export type McNemarPlanning = McNemarAssumptions & {
  alpha: number;
  targetPower: number;
  maxParticipants: number;
};

function validateProbabilities(memoryscapeOnly: number, conventionalOnly: number): void {
  if (!Number.isFinite(memoryscapeOnly) || !Number.isFinite(conventionalOnly)
    || memoryscapeOnly < 0 || conventionalOnly < 0 || memoryscapeOnly + conventionalOnly > 1) {
    throw new Error('discordant probabilities must be nonnegative and sum to at most 1');
  }
}

function logFactorials(maximum: number): number[] {
  const values = Array.from({ length: maximum + 1 }, () => 0);
  for (let value = 2; value <= maximum; value += 1) values[value] = values[value - 1] + Math.log(value);
  return values;
}

function binomialMasses(n: number, probability: number, logFacts: readonly number[]): number[] {
  if (probability === 0) return [1, ...Array.from({ length: n }, () => 0)];
  if (probability === 1) return [...Array.from({ length: n }, () => 0), 1];
  const logMasses = Array.from({ length: n + 1 }, (_, successes) =>
    logFacts[n] - logFacts[successes] - logFacts[n - successes]
      + successes * Math.log(probability) + (n - successes) * Math.log1p(-probability));
  const maximum = Math.max(...logMasses);
  const masses = logMasses.map(value => Math.exp(value - maximum));
  const total = masses.reduce((sum, value) => sum + value, 0);
  return masses.map(value => value / total);
}

function conditionalPowerByDiscordantCount(
  discordantCount: number,
  favorableShare: number,
  alpha: number,
  logFacts: readonly number[],
): number {
  if (discordantCount < 1) return 0;
  const nullMasses = binomialMasses(discordantCount, 0.5, logFacts);
  let lowerTail = 0;
  let criticalCount = -1;
  for (let count = 0; count <= Math.floor(discordantCount / 2); count += 1) {
    lowerTail += nullMasses[count];
    if (2 * lowerTail <= alpha + Number.EPSILON) criticalCount = count;
    else break;
  }
  if (criticalCount < 0) return 0;
  const alternativeMasses = binomialMasses(discordantCount, favorableShare, logFacts);
  let power = 0;
  for (let count = 0; count <= discordantCount; count += 1) {
    if (count <= criticalCount || count >= discordantCount - criticalCount) power += alternativeMasses[count];
  }
  return power;
}

function validateAlpha(alpha: number): void {
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 0.5) throw new Error('alpha must be greater than 0 and less than 0.5');
}

export function exactMcNemarPower(
  participants: number,
  memoryscapeOnly: number,
  conventionalOnly: number,
  alpha = 0.05,
): number {
  validateProbabilities(memoryscapeOnly, conventionalOnly);
  validateAlpha(alpha);
  if (!Number.isInteger(participants) || participants < 1 || participants > MAX_PARTICIPANTS) {
    throw new Error(`participant count must be an integer from 1 to ${MAX_PARTICIPANTS}`);
  }
  const discordance = memoryscapeOnly + conventionalOnly;
  if (!discordance) return 0;
  const logFacts = logFactorials(participants);
  const discordantMasses = binomialMasses(participants, discordance, logFacts);
  const favorableShare = memoryscapeOnly / discordance;
  return discordantMasses.reduce((power, mass, count) =>
    power + mass * conditionalPowerByDiscordantCount(count, favorableShare, alpha, logFacts), 0);
}

export function minimumMcNemarSampleSize({
  memoryscapeOnly,
  conventionalOnly,
  alpha,
  targetPower,
  maxParticipants,
}: McNemarPlanning): number | null {
  validateProbabilities(memoryscapeOnly, conventionalOnly);
  validateAlpha(alpha);
  if (!Number.isFinite(targetPower) || targetPower <= 0 || targetPower >= 1) throw new Error('target power must be greater than 0 and less than 1');
  if (!Number.isInteger(maxParticipants) || maxParticipants < 1 || maxParticipants > MAX_PARTICIPANTS) {
    throw new Error(`maximum participants must be an integer from 1 to ${MAX_PARTICIPANTS}`);
  }
  const discordance = memoryscapeOnly + conventionalOnly;
  if (!discordance) return null;
  const favorableShare = memoryscapeOnly / discordance;
  const logFacts = logFactorials(maxParticipants);
  const conditionalPower = Array.from({ length: maxParticipants + 1 }, (_, count) =>
    conditionalPowerByDiscordantCount(count, favorableShare, alpha, logFacts));
  let discordantDistribution = [1];
  for (let participants = 1; participants <= maxParticipants; participants += 1) {
    const nextDistribution = Array.from({ length: participants + 1 }, () => 0);
    for (let count = 0; count <= participants; count += 1) {
      nextDistribution[count] = (discordantDistribution[count] ?? 0) * (1 - discordance)
        + (count > 0 ? discordantDistribution[count - 1] * discordance : 0);
    }
    discordantDistribution = nextDistribution;
    const power = discordantDistribution.reduce((total, mass, count) => total + mass * conditionalPower[count], 0);
    if (power + Number.EPSILON >= targetPower) return participants;
  }
  return null;
}

export const MAX_STUDY_POWER_PARTICIPANTS = MAX_PARTICIPANTS;
