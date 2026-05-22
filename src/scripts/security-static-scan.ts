import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';

type Finding = {
  filePath: string;
  pattern: string;
  line: number;
  snippet: string;
};

const rootDir = path.join(process.cwd(), 'src');

const suspiciousPatterns: Array<{ name: string; regex: RegExp }> = [
  { name: 'prisma-queryraw-unsafe', regex: /\$queryRawUnsafe\s*\(/g },
  { name: 'prisma-executeraw-unsafe', regex: /\$executeRawUnsafe\s*\(/g },
  { name: 'eval-usage', regex: /\beval\s*\(/g },
  { name: 'function-constructor', regex: /\bnew\s+Function\s*\(/g },
  { name: 'child-process-exec', regex: /from\s+['\"]node:child_process['\"]|from\s+['\"]child_process['\"]/g },
];

async function getFilesRecursively(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'generated' || entry.name === '__tests__') return [];
        return getFilesRecursively(fullPath);
      }
      if (!/\.(ts|js|mjs|cjs)$/.test(entry.name)) return [];
      return [fullPath];
    }),
  );
  return files.flat();
}

function findLineFromIndex(content: string, index: number): number {
  return content.slice(0, index).split(/\r?\n/).length;
}

async function scan(): Promise<Finding[]> {
  const files = await getFilesRecursively(rootDir);
  const findings: Finding[] = [];

  for (const filePath of files) {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    for (const pattern of suspiciousPatterns) {
      const matches = content.matchAll(pattern.regex);
      for (const match of matches) {
        const index = match.index ?? 0;
        const line = findLineFromIndex(content, index);
        findings.push({
          filePath: path.relative(process.cwd(), filePath).replace(/\\/g, '/'),
          pattern: pattern.name,
          line,
          snippet: (lines[line - 1] ?? '').trim(),
        });
      }
    }
  }

  return findings;
}

async function main(): Promise<void> {
  const findings = await scan();
  if (findings.length === 0) {
    console.log('security-static-scan: no suspicious patterns found');
    return;
  }

  console.error('security-static-scan: suspicious patterns detected');
  for (const finding of findings) {
    console.error(
      `${finding.filePath}:${finding.line} [${finding.pattern}] ${finding.snippet}`,
    );
  }
  process.exitCode = 1;
}

main().catch((error) => {
  console.error('security-static-scan failed', error);
  process.exitCode = 1;
});
