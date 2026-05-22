import fs from 'node:fs';
import path from 'node:path';

import { openApiDocument } from '../config/openapi';

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

const METHODS: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete'];
const APP_FILE = path.resolve(process.cwd(), 'src/app.ts');
const SRC_ROOT = path.resolve(process.cwd(), 'src');

const API_PREFIXES = [
  '/auth',
  '/users',
  '/me',
  '/admin',
  '/products',
  '/categories',
  '/orders',
  '/webhooks',
  '/analytics',
  '/blogs',
  '/sitemap.xml',
  '/robots.txt',
];

function normalizeSlashes(input: string): string {
  const normalized = input.replace(/\\/g, '/').replace(/\/+/g, '/');
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;

  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/')) {
    return withLeadingSlash.slice(0, -1);
  }

  return withLeadingSlash;
}

function joinPath(prefix: string, route: string): string {
  if (prefix === '/') {
    return normalizeSlashes(route);
  }

  return normalizeSlashes(`${prefix.replace(/\/$/, '')}/${route.replace(/^\//, '')}`);
}

function toOpenApiPath(expressPath: string): string {
  return expressPath.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function stripLineComment(line: string): string {
  const idx = line.indexOf('//');
  if (idx === -1) {
    return line;
  }

  return line.slice(0, idx);
}

function parseRouteImports(appSource: string): Map<string, string> {
  const imports = new Map<string, string>();
  const importRegex = /import\s*\{\s*([^}]+)\s*\}\s*from\s*["'](.+?\.routes)["'];/g;
  let match = importRegex.exec(appSource);

  while (match) {
    const importedNames = match[1]?.split(',').map((name) => name.trim()).filter(Boolean) ?? [];
    const importPath = match[2] ?? '';

    for (const importedName of importedNames) {
      imports.set(importedName, importPath);
    }

    match = importRegex.exec(appSource);
  }

  return imports;
}

function resolveRouteFile(importPath: string): string {
  const withTsExtension = `${importPath}.ts`;
  return path.resolve(SRC_ROOT, withTsExtension.replace(/^\.\//, ''));
}

function parseMountedRouters(appSource: string): Array<{ prefix: string; routerVar: string }> {
  const mounted: Array<{ prefix: string; routerVar: string }> = [];

  for (const line of appSource.split('\n')) {
    const cleaned = stripLineComment(line).trim();
    if (cleaned.length === 0 || !cleaned.startsWith('app.use(')) {
      continue;
    }

    const withPrefixMatch = cleaned.match(
      /^app\.use\(\s*['"]([^'"]+)['"]\s*,\s*(?:[A-Za-z0-9_]+\s*,\s*)*([A-Za-z0-9_]+)\s*\);$/,
    );

    if (withPrefixMatch?.[1] && withPrefixMatch[2]) {
      mounted.push({ prefix: withPrefixMatch[1], routerVar: withPrefixMatch[2] });
      continue;
    }

    const noPrefixMatch = cleaned.match(/^app\.use\(\s*([A-Za-z0-9_]+)\s*\);$/);
    if (noPrefixMatch?.[1]) {
      mounted.push({ prefix: '/', routerVar: noPrefixMatch[1] });
    }
  }

  return mounted;
}

function extractRouterPaths(routeFile: string, routerVar: string): Set<string> {
  const source = fs.readFileSync(routeFile, 'utf8');
  const paths = new Set<string>();

  for (const method of METHODS) {
    const regex = new RegExp(`${routerVar}\\.${method}\\(\\s*['\"]([^'\"]+)['\"]`, 'g');
    let match = regex.exec(source);

    while (match) {
      const routePath = match[1];
      if (routePath) {
        paths.add(routePath);
      }

      match = regex.exec(source);
    }
  }

  return paths;
}

function shouldCheckPath(pathname: string): boolean {
  return API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function run(): void {
  const appSource = fs.readFileSync(APP_FILE, 'utf8');
  const routeImports = parseRouteImports(appSource);
  const mountedRouters = parseMountedRouters(appSource);

  const discoveredPaths = new Set<string>();

  for (const mounted of mountedRouters) {
    const importPath = routeImports.get(mounted.routerVar);
    if (!importPath) {
      continue;
    }

    const routeFile = resolveRouteFile(importPath);
    if (!fs.existsSync(routeFile)) {
      console.error(`[openapi-routes] route file not found: ${routeFile}`);
      process.exitCode = 1;
      continue;
    }

    const routerPaths = extractRouterPaths(routeFile, mounted.routerVar);
    for (const routerPath of routerPaths) {
      const combined = toOpenApiPath(joinPath(mounted.prefix, routerPath));
      if (shouldCheckPath(combined)) {
        discoveredPaths.add(combined);
      }
    }
  }

  const documentedPaths = new Set(
    Object.keys(openApiDocument.paths)
      .map((pathname) => normalizeSlashes(pathname))
      .filter((pathname) => shouldCheckPath(pathname)),
  );

  const missingInOpenApi = [...discoveredPaths].filter((pathname) => !documentedPaths.has(pathname)).sort();
  const extraInOpenApi = [...documentedPaths].filter((pathname) => !discoveredPaths.has(pathname)).sort();

  if (missingInOpenApi.length === 0 && extraInOpenApi.length === 0) {
    console.log('[openapi-routes] OpenAPI paths are in sync with mounted backend routes.');
    return;
  }

  console.error('[openapi-routes] Route/OpenAPI mismatch detected.');

  if (missingInOpenApi.length > 0) {
    console.error('\nMissing in OpenAPI:');
    for (const pathname of missingInOpenApi) {
      console.error(`  - ${pathname}`);
    }
  }

  if (extraInOpenApi.length > 0) {
    console.error('\nExtra in OpenAPI:');
    for (const pathname of extraInOpenApi) {
      console.error(`  - ${pathname}`);
    }
  }

  process.exit(1);
}

run();
