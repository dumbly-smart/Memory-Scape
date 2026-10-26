import { minimumMcNemarSampleSize, MAX_STUDY_POWER_PARTICIPANTS } from '../lib/research/study-power';

function option(name: string): string | undefined {
  return process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function numericOption(name: string, fallback: number): number {
  const raw = option(name);
  return raw === undefined ? fallback : Number(raw);
}

function main(): void {
  const alpha = numericOption('alpha', 0.05);
  const targetPower = numericOption('power', 0.8);
  const maxParticipants = numericOption('max', MAX_STUDY_POWER_PARTICIPANTS);
  const memoryscapeOnly = option('memoryscape-only');
  const conventionalOnly = option('conventional-only');
  if ((memoryscapeOnly === undefined) !== (conventionalOnly === undefined)) {
    throw new Error('provide both --memoryscape-only and --conventional-only, or neither');
  }
  const scenarios = memoryscapeOnly === undefined
    ? [
      { label: 'small discordance / modest effect', memoryscapeOnly: 0.1, conventionalOnly: 0.05 },
      { label: 'moderate discordance / modest effect', memoryscapeOnly: 0.15, conventionalOnly: 0.05 },
      { label: 'moderate discordance / small effect', memoryscapeOnly: 0.2, conventionalOnly: 0.1 },
      { label: 'large discordance / small effect', memoryscapeOnly: 0.25, conventionalOnly: 0.15 },
      { label: 'larger effect', memoryscapeOnly: 0.3, conventionalOnly: 0.1 },
    ]
    : [{ label: 'user-supplied assumption', memoryscapeOnly: Number(memoryscapeOnly), conventionalOnly: Number(conventionalOnly) }];

  console.log('Paired binary accuracy — exact conditional McNemar sample-size sensitivity');
  console.log(`Two-sided alpha=${alpha}; target power=${targetPower}; search cap=${maxParticipants} participants.`);
  console.log('Discordant rates are assumptions: MemoryScape-only correct / conventional-only correct.');
  console.log('Scenario | Pairwise accuracy difference | Discordant pairs | Minimum participants');
  for (const scenario of scenarios) {
    const sampleSize = minimumMcNemarSampleSize({ ...scenario, alpha, targetPower, maxParticipants });
    const difference = scenario.memoryscapeOnly - scenario.conventionalOnly;
    console.log(`${scenario.label} | ${difference.toFixed(3)} | ${(scenario.memoryscapeOnly + scenario.conventionalOnly).toFixed(3)} | ${sampleSize ?? `>${maxParticipants}`}`);
  }
  console.log('\nThese are sensitivity calculations, not a study recommendation. Use pilot-based discordance assumptions, account for attrition and multiplicity, and preregister the analysis after institutional approval.');
}

main();
