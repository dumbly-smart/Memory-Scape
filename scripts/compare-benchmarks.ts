import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  compareBenchmarkArtifacts,
  renderBenchmarkComparison,
  type ComparisonArtifact,
} from './benchmark-comparison';

async function main() {
  const inputs = process.argv.slice(2);
  if (inputs.length < 2) {
    throw new Error('Usage: npm run db:benchmark:compare -- <machine-a.json> <machine-b.json> [more.json ...]');
  }
  const artifacts = await Promise.all(inputs.map(async (inputPath) => {
    const absolutePath = path.resolve(inputPath);
    const parsed = JSON.parse(await readFile(absolutePath, 'utf8')) as ComparisonArtifact;
    const environment = parsed.environment as ComparisonArtifact['environment'] & { machineLabel?: string };
    return {
      ...parsed,
      machineLabel: parsed.machineLabel || environment.machineLabel || path.basename(path.dirname(absolutePath)),
    };
  }));
  const rows = compareBenchmarkArtifacts(artifacts);
  const environmentLines = artifacts.map((artifact) => {
    const environment = artifact.environment as ComparisonArtifact['environment'] & {
      platform?: string;
      arch?: string;
      cpus?: number;
      totalMemoryBytes?: number;
      node?: string;
    };
    const memoryGiB = environment.totalMemoryBytes === undefined
      ? 'unknown'
      : (environment.totalMemoryBytes / 1024 ** 3).toFixed(1);
    return `- **${artifact.machineLabel}** — ${environment.platform ?? 'unknown'}/${environment.arch ?? 'unknown'}, ${environment.cpus ?? 'unknown'} CPUs, ${memoryGiB} GiB RAM, Node ${environment.node ?? 'unknown'}, ${environment.postgres}`;
  });
  const markdown = `${renderBenchmarkComparison(rows)}\n## Host metadata\n\n${environmentLines.join('\n')}\n\nSource artifacts: ${inputs.map((input) => `\`${input}\``).join(', ')}.\n`;
  const markdownPath = path.resolve(process.env.BENCHMARK_COMPARISON_MARKDOWN ?? 'docs/evaluation/CROSS_MACHINE_RESULTS.md');
  const jsonPath = path.resolve(process.env.BENCHMARK_COMPARISON_JSON ?? 'docs/evaluation/CROSS_MACHINE_RESULTS.json');
  await Promise.all([markdownPath, jsonPath].map((outputPath) => mkdir(path.dirname(outputPath), { recursive: true })));
  await Promise.all([
    writeFile(markdownPath, markdown),
    writeFile(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), sourceFiles: inputs, rows }, null, 2)),
  ]);
  console.log(`Compared ${artifacts.length} matching benchmark artifacts.`);
  console.log(`Markdown: ${markdownPath}`);
  console.log(`JSON: ${jsonPath}`);
}

main().catch((error: unknown) => {
  console.error('Benchmark comparison failed:', error);
  process.exitCode = 1;
});
