// Regenerates `src/lib/icons/*.gen.ts` from the curated icon manifest.
//
//   pnpm generate-icons
//
// Run it in the same commit as any change to `src/lib/icons/icons.manifest.json`, which is
// the only place icon ids are listed. The path data is read from the pinned
// `@phosphor-icons/core` devDependency in `node_modules` — never from the network — so a
// lockfile run reproduces the output byte for byte. It refuses to write a partial pack.

import { execFileSync } from 'node:child_process'
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const FRONTEND = resolve(HERE, '..')
const OUT_DIR = resolve(FRONTEND, 'src/lib/icons')
const MANIFEST = resolve(OUT_DIR, 'icons.manifest.json')

const PACKAGE = '@phosphor-icons/core'
const PACKAGE_DIR = resolve(FRONTEND, 'node_modules', PACKAGE)
const MIN_ICONS = 200
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

function fail(message) {
  console.error(`generate-icons: ${message}`)
  process.exit(1)
}

function readJson(path, what) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    return fail(`cannot read ${what} at ${path} — ${error.message}`)
  }
}

function readManifest() {
  const manifest = readJson(MANIFEST, 'the icon manifest')
  const { source, groups, icons } = manifest
  if (!source?.package || !source.version || !source.weight) {
    fail('the manifest needs source.package, source.version and source.weight')
  }
  if (source.package !== PACKAGE) {
    fail(
      `the manifest sources ${source.package}, but this script only knows ${PACKAGE}`,
    )
  }
  if (!Array.isArray(groups) || groups.length === 0) {
    fail('the manifest declares no groups')
  }
  if (!Array.isArray(icons)) fail('the manifest has no icons array')
  if (icons.length < MIN_ICONS) {
    fail(
      `only ${icons.length} icons in the manifest; the floor is ${MIN_ICONS}`,
    )
  }
  return manifest
}

function checkVersion(source) {
  const installed = readJson(
    resolve(PACKAGE_DIR, 'package.json'),
    `the installed ${PACKAGE}`,
  ).version
  if (installed !== source.version) {
    fail(
      `${PACKAGE}@${installed} is installed but the manifest pins ${source.version} — ` +
        `run \`pnpm add -D ${PACKAGE}@${source.version}\` or update the manifest`,
    )
  }
}

function checkGroups(groups) {
  const byKey = new Map()
  for (const group of groups) {
    if (!group?.key || !group.label) fail('every group needs a key and a label')
    if (byKey.has(group.key)) fail(`group "${group.key}" is declared twice`)
    byKey.set(group.key, group)
  }
  return byKey
}

function checkIcons(icons, groupKeys) {
  const seen = new Set()
  const used = new Set()
  for (const icon of icons) {
    const { id, group, label, keywords } = icon ?? {}
    if (!id || !ID_PATTERN.test(id)) {
      fail(`"${id}" is not a usable icon id — expected lowercase-kebab-case`)
    }
    if (seen.has(id)) fail(`icon id "${id}" appears twice in the manifest`)
    seen.add(id)
    if (!groupKeys.has(group)) {
      fail(`icon "${id}" is in group "${group}", which no group declares`)
    }
    used.add(group)
    if (typeof label !== 'string' || label.trim() === '') {
      fail(`icon "${id}" has no label`)
    }
    if (
      !Array.isArray(keywords) ||
      keywords.some((k) => typeof k !== 'string' || !k.trim())
    ) {
      fail(`icon "${id}" has unusable keywords`)
    }
  }
  for (const key of groupKeys.keys()) {
    if (!used.has(key)) fail(`group "${key}" has no icons`)
  }
}

function extractPath(id, weight) {
  const file = resolve(PACKAGE_DIR, 'assets', weight, `${id}.svg`)
  let svg
  try {
    svg = readFileSync(file, 'utf8')
  } catch {
    fail(
      `icon "${id}" has no ${weight} asset at ${file} — it may have been renamed upstream`,
    )
  }
  const data = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1])
  if (data.length === 0) fail(`icon "${id}" has no <path> data in ${file}`)
  return data.join(' ')
}

function assertConsistent(entries) {
  const ids = entries.map((e) => e.id)
  for (const entry of entries) {
    if (!entry.d.trim()) fail(`icon "${entry.id}" resolved to an empty path`)
    if (!entry.label.trim())
      fail(`icon "${entry.id}" resolved to an empty label`)
  }
  if (new Set(ids).size !== ids.length)
    fail('the resolved pack contains duplicate ids')
  if (ids.length < MIN_ICONS)
    fail(`only ${ids.length} icons resolved; the floor is ${MIN_ICONS}`)
}

const HEADER = `// GENERATED FILE — do not edit by hand. Run \`pnpm generate-icons\`.\n`
const q = (value) => JSON.stringify(value)

function renderCatalog(groups, entries) {
  const ids = entries.map((e) => `  ${q(e.id)},`).join('\n')
  const keys = groups.map((g) => `  | ${q(g.key)}`).join('\n')
  const groupLines = groups
    .map((group) => {
      const members = entries
        .filter((e) => e.group === group.key)
        .map((e) => `      ${q(e.id)},`)
        .join('\n')
      return `  {\n    key: ${q(group.key)},\n    label: ${q(group.label)},\n    ids: [\n${members}\n    ],\n  },`
    })
    .join('\n')

  return `${HEADER}
export const ICON_IDS = [
${ids}
] as const

export type IconId = (typeof ICON_IDS)[number]

export type IconGroupKey =
${keys}

export type IconGroup = {
  readonly key: IconGroupKey
  readonly label: string
  readonly ids: readonly IconId[]
}

export const ICON_GROUPS: readonly IconGroup[] = [
${groupLines}
]

const KNOWN: ReadonlySet<string> = new Set(ICON_IDS)

export const isIconId = (value: unknown): value is IconId =>
  typeof value === 'string' && KNOWN.has(value)
`
}

function renderPaths(source, license, entries) {
  const body = entries.map((e) => `  ${q(e.id)}: ${q(e.d)},`).join('\n')
  const notice = license
    .split('\n')
    .slice(0, 3)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' — ')

  // `/*!` and `@license` are the markers minifiers preserve; the vendored
  // PHOSPHOR-LICENSE.txt is the copy that survives a pipeline that strips them anyway.
  return `/*! @license ${source.package} v${source.version} (${source.weight}) — ${notice}. Full text: src/lib/icons/PHOSPHOR-LICENSE.txt */
${HEADER}import type { IconId } from './catalog.gen'

export const PATHS: Record<IconId, string> = {
${body}
}
`
}

function renderSearch(entries) {
  const body = entries
    .map(
      (e) =>
        `  ${q(e.id)}: { label: ${q(e.label)}, keywords: [${e.keywords.map(q).join(', ')}] },`,
    )
    .join('\n')

  return `${HEADER}import type { IconId } from './catalog.gen'

export type IconSearchEntry = {
  label: string
  keywords: string[]
}

export const SEARCH: Record<IconId, IconSearchEntry> = {
${body}
}
`
}

function format(paths) {
  try {
    execFileSync(
      process.execPath,
      [
        resolve(FRONTEND, 'node_modules/prettier/bin/prettier.cjs'),
        '--write',
        ...paths,
      ],
      { stdio: 'pipe' },
    )
  } catch (error) {
    fail(`prettier could not format the generated files: ${error.message}`)
  }
}

const { source, groups, icons } = readManifest()
checkVersion(source)
const groupKeys = checkGroups(groups)
checkIcons(icons, groupKeys)

const entries = icons.map((icon) => ({
  ...icon,
  d: extractPath(icon.id, source.weight),
}))
assertConsistent(entries)

const license = readFileSync(resolve(PACKAGE_DIR, 'LICENSE'), 'utf8')
const written = {
  catalog: resolve(OUT_DIR, 'catalog.gen.ts'),
  paths: resolve(OUT_DIR, 'paths.gen.ts'),
  search: resolve(OUT_DIR, 'search.gen.ts'),
}

writeFileSync(written.catalog, renderCatalog(groups, entries), 'utf8')
writeFileSync(written.paths, renderPaths(source, license, entries), 'utf8')
writeFileSync(written.search, renderSearch(entries), 'utf8')
copyFileSync(
  resolve(PACKAGE_DIR, 'LICENSE'),
  resolve(OUT_DIR, 'PHOSPHOR-LICENSE.txt'),
)
format(Object.values(written))

const bytes = Object.values(written).reduce(
  (total, path) => total + readFileSync(path).byteLength,
  0,
)

console.log(
  `generate-icons: ${entries.length} icons, ${groups.length} groups, ${bytes} bytes ` +
    `from ${source.package}@${source.version} (${source.weight}) → src/lib/icons/`,
)
