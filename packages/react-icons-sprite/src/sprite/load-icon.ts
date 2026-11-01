import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  hasVersionedIconResolver,
  type ImportResolver,
  selectIconImportResolver,
} from '../packs/icon-resolvers';
import { createModuleParser } from '../transform/parse-module';
import { createStaticIconLoader } from './static-icon-loader';

type PackageJson = {
  version?: string;
  exports?: unknown;
  module?: string;
  main?: string;
};

export type IconLoadOptions = {
  baseDir?: string;
  importer?: string;
  importPath?: string;
};

type PackageInfo = {
  manifest: PackageJson;
  resolveImport: ImportResolver;
};

type ResolutionCache = {
  roots: Map<string, string | null>;
  packages: Map<string, PackageInfo>;
  reexports: Map<string, Map<string, string>>;
  loadStatic: ReturnType<typeof createStaticIconLoader>;
};

const resolveLucideAlias = (
  entryFile: string,
  exportName: string,
  cache: ResolutionCache,
): string | null => {
  let reexports = cache.reexports.get(entryFile);
  if (!reexports) {
    reexports = new Map();
    cache.reexports.set(entryFile, reexports);
    try {
      const program = createModuleParser()(
        entryFile,
        readFileSync(entryFile, 'utf8'),
      );
      for (const node of program?.body ?? []) {
        if (
          node.type !== 'ExportNamedDeclaration' ||
          !node.source?.value.startsWith('.')
        ) {
          continue;
        }
        for (const specifier of node.specifiers) {
          if (
            specifier.local.type === 'Identifier' &&
            specifier.local.name === 'default'
          ) {
            const name =
              specifier.exported.type === 'Identifier'
                ? specifier.exported.name
                : specifier.exported.value;
            reexports.set(name, node.source.value);
          }
        }
      }
    } catch {
      // Unrecognized layouts still use the library entry module.
    }
  }
  const target = reexports.get(exportName);
  return target
    ? resolveFileCandidate(path.resolve(path.dirname(entryFile), target))
    : null;
};

const readPackageInfo = (
  packageRoot: string,
  packageName: string,
  cache: ResolutionCache,
): PackageInfo => {
  let info = cache.packages.get(packageRoot);
  if (!info) {
    const manifest = JSON.parse(
      readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
    ) as PackageJson;
    info = {
      manifest,
      resolveImport: selectIconImportResolver(packageName, manifest.version),
    };
    cache.packages.set(packageRoot, info);
  }
  return info;
};

const parsePackageSpecifier = (
  specifier: string,
): { packageName: string; subpath: string } | null => {
  if (specifier.startsWith('.') || path.isAbsolute(specifier)) {
    return null;
  }

  const parts = specifier.split('/');
  const packageName = specifier.startsWith('@')
    ? `${parts[0]}/${parts[1]}`
    : parts[0];
  const rest = parts.slice(specifier.startsWith('@') ? 2 : 1).join('/');

  return {
    packageName,
    subpath: rest ? `./${rest}` : '.',
  };
};

const findPackageRoot = (
  packageName: string,
  baseDir: string,
  cache: ResolutionCache,
): string | null => {
  let current = path.resolve(baseDir);
  const visited: string[] = [];

  const remember = (root: string | null) => {
    for (const key of visited) {
      cache.roots.set(key, root);
    }
    return root;
  };

  while (true) {
    const key = JSON.stringify([packageName, current]);
    const cachedRoot = cache.roots.get(key);
    if (cachedRoot !== undefined) {
      return remember(cachedRoot);
    }
    visited.push(key);
    const candidate = path.join(current, 'node_modules', packageName);
    if (existsSync(path.join(candidate, 'package.json'))) {
      return remember(candidate);
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return remember(null);
    }
    current = parent;
  }
};

const pickExportTarget = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return value;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  return (
    pickExportTarget(record.import) ??
    pickExportTarget(record.default) ??
    pickExportTarget(record.module) ??
    pickExportTarget(record.require)
  );
};

const resolveExportTarget = (
  exportsField: unknown,
  subpath: string,
): string | null => {
  if (typeof exportsField === 'string' || Array.isArray(exportsField)) {
    return subpath === '.' ? pickExportTarget(exportsField) : null;
  }

  if (!exportsField || typeof exportsField !== 'object') {
    return null;
  }

  const exportsRecord = exportsField as Record<string, unknown>;

  const exact = pickExportTarget(exportsRecord[subpath]);
  if (exact) {
    return exact;
  }

  for (const [key, value] of Object.entries(exportsRecord)) {
    if (!key.includes('*')) {
      continue;
    }

    const [prefix, suffix] = key.split('*');
    if (!subpath.startsWith(prefix) || !subpath.endsWith(suffix)) {
      continue;
    }

    const matched = subpath.slice(
      prefix.length,
      subpath.length - suffix.length,
    );
    const target = pickExportTarget(value);
    if (target) {
      return target.replaceAll('*', matched);
    }
  }

  return null;
};

const fileExists = (filePath: string): boolean => {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
};

const resolveFileCandidate = (filePath: string): string | null => {
  if (fileExists(filePath)) {
    return filePath;
  }
  const candidates = [
    `${filePath}.mjs`,
    `${filePath}.js`,
    `${filePath}.cjs`,
    `${filePath}.jsx`,
    `${filePath}.ts`,
    `${filePath}.tsx`,
    path.join(filePath, 'index.mjs'),
    path.join(filePath, 'index.js'),
    path.join(filePath, 'index.cjs'),
    path.join(filePath, 'index.jsx'),
    path.join(filePath, 'index.ts'),
    path.join(filePath, 'index.tsx'),
  ];

  return candidates.find(fileExists) ?? null;
};

const resolveFromPackageRoot = (
  packageRoot: string,
  subpath: string,
  packageJson: PackageJson,
): string | null => {
  const exportTarget = resolveExportTarget(packageJson.exports, subpath);

  if (exportTarget) {
    const resolved = resolveFileCandidate(path.join(packageRoot, exportTarget));
    if (resolved) {
      return resolved;
    }
  }

  if (subpath === '.') {
    const entry = packageJson.module ?? packageJson.main;
    if (entry) {
      return resolveFileCandidate(path.join(packageRoot, entry));
    }
  }

  return resolveFileCandidate(path.join(packageRoot, subpath));
};

const resolveFromBaseDir = (
  specifier: string,
  baseDir: string,
  cache: ResolutionCache,
): string | null => {
  const parsed = parsePackageSpecifier(specifier);
  if (!parsed) {
    return null;
  }
  const packageRoot = findPackageRoot(parsed.packageName, baseDir, cache);
  return packageRoot
    ? resolveFromPackageRoot(
        packageRoot,
        parsed.subpath,
        readPackageInfo(packageRoot, parsed.packageName, cache).manifest,
      )
    : null;
};

const resolveImportSpecifier = (
  specifier: string,
  options: IconLoadOptions,
  cache: ResolutionCache,
): string => {
  if (path.isAbsolute(specifier)) {
    const resolved = resolveFileCandidate(specifier);
    return pathToFileURL(resolved ?? specifier).href;
  }

  if (specifier.startsWith('.') && options.importer) {
    const importerPath = options.importer.split('?', 1)[0];
    const resolved = resolveFileCandidate(
      path.resolve(path.dirname(importerPath), specifier),
    );
    if (resolved) {
      return pathToFileURL(resolved).href;
    }
  }

  if (!options.baseDir) {
    return specifier;
  }

  const resolved = resolveFromBaseDir(specifier, options.baseDir, cache);
  return resolved ? pathToFileURL(resolved).href : specifier;
};

const pickExport = (
  moduleExports: Record<string, unknown>,
  exportName: string,
): unknown => {
  if (exportName === 'default') {
    return moduleExports.default;
  }
  const defaultExport = moduleExports.default;
  const nestedExport =
    defaultExport && typeof defaultExport === 'object'
      ? (defaultExport as Record<string, unknown>)[exportName]
      : undefined;
  return moduleExports[exportName] ?? nestedExport ?? defaultExport;
};

const unwrapNestedDefaultExport = (value: unknown): unknown => {
  if (!value || typeof value !== 'object' || !('default' in value)) {
    return value;
  }

  if ('$$typeof' in value) {
    return value;
  }

  return (value as { default: unknown }).default;
};

type PreparedIcon = () => unknown;

const prepareIcon = async (
  pack: string,
  exportName: string,
  options: IconLoadOptions,
  cache: ResolutionCache,
): Promise<PreparedIcon> => {
  let packageRoot: string | null = null;
  let packageInfo: PackageInfo | undefined;
  const packageName = parsePackageSpecifier(pack)?.packageName ?? pack;
  if (!options.importPath && hasVersionedIconResolver(pack)) {
    const baseDir = options.baseDir ?? process.cwd();
    const importerDir = options.importer
      ? path.dirname(options.importer.split('?', 1)[0])
      : baseDir;
    packageRoot =
      findPackageRoot(packageName, importerDir, cache) ??
      findPackageRoot(packageName, baseDir, cache);
    if (packageRoot) {
      packageInfo = readPackageInfo(packageRoot, packageName, cache);
    }
  }

  const importPath =
    options.importPath ?? packageInfo?.resolveImport(pack, exportName) ?? pack;
  let specifier = importPath;
  let resolvedPath: string | null = null;
  let resolvedExportName = exportName;
  if (packageRoot && packageInfo) {
    const subpath = parsePackageSpecifier(importPath)?.subpath ?? '.';
    resolvedPath = resolveFromPackageRoot(
      packageRoot,
      subpath,
      packageInfo.manifest,
    );
    specifier =
      resolvedPath ??
      path.join(packageRoot, subpath === '.' ? 'index.js' : subpath);
  }
  if (
    pack === 'lucide-react' &&
    packageRoot &&
    importPath.startsWith(`${pack}/`) &&
    !resolvedPath &&
    !fileExists(specifier)
  ) {
    // Renamed icons and unusual spellings are still exported by the entry module.
    specifier = path.join(
      packageRoot,
      `dist/esm/lucide-react${path.extname(specifier)}`,
    );
    resolvedPath = resolveLucideAlias(specifier, exportName, cache);
    if (resolvedPath) {
      resolvedExportName = 'default';
    }
  }
  const staticComponent =
    resolvedPath && !options.importPath
      ? await cache.loadStatic(
          pack,
          resolvedPath,
          resolvedExportName,
          packageInfo?.manifest.version,
        )
      : null;
  if (staticComponent) {
    return () => staticComponent;
  }
  return async () => {
    const imported = (await import(
      resolvedPath
        ? pathToFileURL(resolvedPath).href
        : resolveImportSpecifier(specifier, options, cache)
    )) as Record<string, unknown>;
    return unwrapNestedDefaultExport(
      pickExport(
        imported,
        resolvedExportName === 'default' &&
          imported.default === undefined &&
          packageRoot &&
          importPath !== pack &&
          pack !== packageName
          ? (pack.split('/').at(-1) ?? resolvedExportName)
          : resolvedExportName,
      ),
    );
  };
};

// Share resolution work within a sprite build; each new build starts fresh.
export const createIconLoader = () => {
  const cache: ResolutionCache = {
    roots: new Map(),
    packages: new Map(),
    reexports: new Map(),
    loadStatic: createStaticIconLoader(),
  };
  const prepared = new Map<string, Promise<PreparedIcon>>();
  const prepare = (
    pack: string,
    exportName: string,
    options: IconLoadOptions,
  ) => {
    const key = JSON.stringify([
      pack,
      exportName,
      options.baseDir,
      options.importer,
      options.importPath,
    ]);
    let pending = prepared.get(key);
    if (!pending) {
      pending = prepareIcon(pack, exportName, options, cache);
      // Prefetch failures are reported when the collected icon is rendered.
      void pending.catch(() => {});
      prepared.set(key, pending);
    }
    return pending;
  };
  const load = (
    pack: string,
    exportName: string,
    options: IconLoadOptions = {},
  ) => prepare(pack, exportName, options).then((prepared) => prepared());
  const preload = (
    pack: string,
    exportName: string,
    options: IconLoadOptions = {},
  ): Promise<void> => {
    if (
      options.importPath ||
      (pack !== 'lucide-react' && !/^react-icons\/[\w-]+$/.test(pack))
    ) {
      return Promise.resolve();
    }
    const pending = prepare(pack, exportName, options).then(() => {});
    void pending.catch(() => {});
    return pending;
  };
  return Object.assign(load, { preload });
};
