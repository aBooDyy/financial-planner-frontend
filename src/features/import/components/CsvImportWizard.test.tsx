// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { db } from '#/db/db'
import { buildCatalog } from '#/features/categories/data/catalog'
import { draftForFile } from '#/features/import/data/mapping'
import { configFromDraft, signatureOf } from '#/features/import/data/templates'
import { CsvImportWizard } from './CsvImportWizard'
import type { LocalImportTemplate } from '#/db/types'
import type { MappingDraft } from '#/features/import/data/mapping'
import type {
  CsvImport,
  ImportFileInfo,
  ImportStep,
} from '#/features/import/hooks/useCsvImport'

const DIALECT = {
  delimiter: ',',
  quote: '"',
  encoding: 'utf-8',
  decimal: '.' as const,
  skipRows: 0,
  hasHeader: true,
}

const HEADERS = ['Date', 'Description', 'Debit', 'Credit']
const MATRIX = [
  ['01/08/2026', 'CARREFOUR HYPER', '142.50', ''],
  ['24/08/2026', 'SALARY', '', '8400.00'],
]

const file: ImportFileInfo = {
  name: 'alrajhi.csv',
  size: 1200,
  dialect: DIALECT,
  headers: HEADERS,
  rowCount: 2,
  columnCount: 4,
  sample: MATRIX,
}

const aDraft = (): MappingDraft =>
  draftForFile({
    dialect: DIALECT,
    headers: HEADERS,
    matrix: MATRIX,
    currency: 'SAR',
    fallbackCategory: 'other',
  })

const aWizard = (step: ImportStep, draft: MappingDraft | null): CsvImport =>
  ({
    step,
    furthest: step,
    canGoTo: () => true,
    read: draft ? { status: 'ready' } : { status: 'idle' },
    scan: { running: false, done: 0, total: 0, result: null },
    file: draft ? file : null,
    draft,
    mapping: null,
    suggestedRoles: draft?.roles ?? [],
    matrix: MATRIX,
    rowAt: () => null,
    context: { today: '2026-09-01', walletCurrencies: {} },
    walletGroups: [],
    catalog: buildCatalog([]),
    categories: [],
    fallbackCategory: 'other',
    merchantIndex: { merchants: [], aliases: [] },
    baseCurrency: 'SAR',
    templateId: 'one-time',
    actions: {
      openFile: vi.fn(),
      cancelRead: vi.fn(),
      setDialect: vi.fn(),
      chooseTemplate: vi.fn(),
      updateMapping: vi.fn(),
      goTo: vi.fn(),
      next: vi.fn(),
      back: vi.fn(),
      reset: vi.fn(),
    },
  }) as unknown as CsvImport

beforeAll(() => {
  // The shared modal chrome asks for a breakpoint jsdom cannot answer.
  window.matchMedia = (query: string) =>
    ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList
})

// `globals` is off in this project, so Testing Library's auto-cleanup never registers.
afterEach(cleanup)

const savedTemplate = async (
  over: Partial<LocalImportTemplate> = {},
): Promise<void> => {
  await db.importTemplates.put({
    id: 't1',
    name: 'Al Rajhi',
    sourceKind: 'csv',
    signature: signatureOf(HEADERS, ','),
    config: configFromDraft(aDraft()),
    lastUsedAt: '2026-09-01T00:00:00Z',
    useCount: 4,
    nameConflict: 0,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
    version: 'v1',
    dirty: 0,
    deleted: 0,
    ...over,
  })
}

beforeEach(async () => {
  await db.importTemplates.clear()
})

describe('CsvImportWizard', () => {
  it('opens on the drop zone and says the file stays on the device', () => {
    render(<CsvImportWizard csv={aWizard('file', null)} />)

    expect(screen.getByText(/never uploaded/i, { exact: false })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Choose a file' })).toBeDefined()
  })

  it('shows one role picker per column, marked where detection proposed it', () => {
    render(<CsvImportWizard csv={aWizard('columns', aDraft())} />)

    expect(screen.getByLabelText('What Date holds')).toBeDefined()
    expect(screen.getByLabelText('What Credit holds')).toBeDefined()
    expect(screen.getAllByText('✓ auto')).toHaveLength(4)
  })

  it('warns on step ② that nothing names the account', () => {
    render(<CsvImportWizard csv={aWizard('columns', aDraft())} />)

    expect(screen.getByText(/No column is marked as Account/)).toBeDefined()
  })

  it('names what is missing instead of only disabling Next', () => {
    const draft = aDraft()
    render(
      <CsvImportWizard
        csv={aWizard('columns', {
          ...draft,
          roles: ['skip', 'merchant', 'amountOut', 'amountIn'],
        })}
      />,
    )

    expect(
      screen.getByText('Pick the column that holds the date.'),
    ).toBeDefined()
    expect(screen.getByRole('button', { name: /Next: values/ })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('asks about the file’s own words on step ③', () => {
    render(<CsvImportWizard csv={aWizard('values', aDraft())} />)

    // The file has no account column: step ③ says so rather than rendering nothing.
    expect(
      screen.getByText(/No column in this file holds an account/),
    ).toBeDefined()
    expect(screen.getByRole('button', { name: /Next: review/ })).toBeDefined()
  })

  it('marks the saved template whose signature matches the file', async () => {
    await savedTemplate()

    render(<CsvImportWizard csv={aWizard('file', aDraft())} />)

    expect(await screen.findByText('Al Rajhi')).toBeDefined()
    expect(screen.getByText('✓ looks like this file')).toBeDefined()
    expect(screen.getByText(/^used 4 times · last /)).toBeDefined()
    // The one-time row is always there: the signature suggests, it never applies itself.
    expect(screen.getByText('Set it up for this file')).toBeDefined()
  })

  it('lists a mapping it cannot read, and refuses to apply it', async () => {
    await savedTemplate({ config: null })

    render(<CsvImportWizard csv={aWizard('file', aDraft())} />)

    expect(await screen.findByText('needs rebuilding')).toBeDefined()
    expect(screen.getByRole('radio', { name: /Al Rajhi/ })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('defaults a one-time mapping to “don’t save”', async () => {
    render(<CsvImportWizard csv={aWizard('values', aDraft())} />)

    const decline = await screen.findByRole('radio', { name: 'Don’t save' })
    expect(decline).toHaveProperty('checked', true)
    expect(screen.queryByLabelText('Template name')).toBeNull()
    expect(screen.getByText(/nothing is saved/i)).toBeDefined()
  })

  it('defaults to updating the template the import started from', async () => {
    await savedTemplate()

    render(
      <CsvImportWizard
        csv={{ ...aWizard('values', aDraft()), templateId: 't1' }}
      />,
    )

    const update = await screen.findByRole('radio', {
      name: 'Update “Al Rajhi”',
    })
    expect(update).toHaveProperty('checked', true)

    fireEvent.click(
      screen.getByRole('radio', { name: 'Save as a new template' }),
    )
    const name = screen.getByLabelText<HTMLInputElement>('Template name')
    expect(name.value).toBe('Alrajhi')

    fireEvent.change(name, { target: { value: 'Al Rajhi' } })
    expect(
      screen.getByText('You already have a template with that name.'),
    ).toBeDefined()
  })

  it('reaches review with a count, and writes nothing', () => {
    render(<CsvImportWizard csv={aWizard('review', aDraft())} />)

    expect(screen.getByText(/0 rows · ✅ 0 ready/)).toBeDefined()
    expect(screen.getByRole('button', { name: /^Import 0/ })).toHaveProperty(
      'disabled',
      true,
    )
    expect(screen.getByText(/Nothing is selected/)).toBeDefined()
  })
})
