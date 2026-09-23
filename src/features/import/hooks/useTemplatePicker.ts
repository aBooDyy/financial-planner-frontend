import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { draftForFile } from '#/features/import/data/mapping'
import {
  applyTemplateConfig,
  categoryKeyOf,
  needsReread,
  rankTemplates,
  signatureOf,
  templateHint,
} from '#/features/import/data/templates'
import { ONE_TIME_TEMPLATE } from '#/features/import/hooks/useCsvImport'
import { useSavedTemplates } from '#/features/import/hooks/useSavedTemplates'
import { useDirectionStore } from '#/stores/direction'
import type { LocalImportTemplate } from '#/db/types'
import type { TemplateOption } from '#/features/import/components/TemplatePicker'
import type {
  TemplateCatalogue,
  UnknownAlias,
} from '#/features/import/data/templates'
import type { CsvImport } from '#/features/import/hooks/useCsvImport'
import type { Dialect } from '#/features/import/data/types'

/**
 * Step ①'s template list, and what happens when one is picked. The signature only
 * pre-selects; applying is the user's act, and everything a template answered with
 * something that no longer exists is dropped and reported rather than silently restored.
 */

export type TemplatePicker = {
  options: TemplateOption[]
  templates: LocalImportTemplate[]
  /** This file's header signature — what a saved template is matched against. */
  signature: string | null
  /** The template currently applied to the mapping, if any. */
  applied: LocalImportTemplate | null
  unknown: UnknownAlias[]
  /** Where *Continue* goes: a restored mapping needs no column or value questions. */
  continueTo: () => void
}

const dialectKey = (dialect: Dialect): string => JSON.stringify(dialect)

export function useTemplatePicker(csv: CsvImport): TemplatePicker {
  const { templates } = useSavedTemplates()
  const locale = useDirectionStore((s) => s.locale)
  const { updateMapping, setDialect, goTo, next } = csv.actions
  const { file, templateId, baseCurrency, walletGroups, categories } = csv
  const fallbackCategory = csv.fallbackCategory
  const [unknown, setUnknown] = useState<UnknownAlias[]>([])

  // Keyed by template *and* by how the file is currently read: restoring a saved dialect
  // re-parses the file, which replaces the draft, so the rest has to be laid on again.
  const appliedToken = useRef<string | null>(null)
  const rereadFor = useRef<string | null>(null)

  const signature = useMemo(
    () =>
      file === null ? null : signatureOf(file.headers, file.dialect.delimiter),
    [file],
  )

  const ranked = useMemo(
    () => rankTemplates(templates, signature),
    [templates, signature],
  )

  const options: TemplateOption[] = useMemo(
    () =>
      ranked.map((template) => ({
        id: template.id,
        name: template.name,
        hint: templateHint(template, locale),
        matchesFile:
          template.config !== null && template.signature === signature,
        // A blob this client cannot read cannot be applied — it is listed so the user knows
        // why, not offered as if it would work.
        disabled: template.config === null,
      })),
    [ranked, signature, locale],
  )

  const catalogue: TemplateCatalogue = useMemo(
    () => ({
      walletIds: new Set(
        walletGroups.flatMap((group) => group.wallets.map((w) => w.id)),
      ),
      categoryKeys: new Set(
        categories.map((option) =>
          categoryKeyOf(option.category, option.subcategory),
        ),
      ),
      merchantIds: new Set(csv.merchantIndex.merchants.map((m) => m.id)),
    }),
    [walletGroups, categories, csv.merchantIndex],
  )

  const applied = useMemo(
    () => ranked.find((t) => t.id === templateId && t.config !== null) ?? null,
    [ranked, templateId],
  )

  useEffect(() => {
    if (file === null) return
    if (templateId === ONE_TIME_TEMPLATE) {
      // Going back to a one-time mapping starts from detection again, so a template's
      // answers cannot linger in a mapping that is never going to be saved.
      if (appliedToken.current !== null) {
        appliedToken.current = null
        rereadFor.current = null
        setUnknown([])
        updateMapping((_current, matrix) =>
          draftForFile({
            dialect: file.dialect,
            headers: file.headers,
            matrix,
            currency: baseCurrency,
            fallbackCategory,
          }),
        )
      }
      return
    }

    const template = ranked.find((t) => t.id === templateId)
    const config = template?.config
    if (!config) return

    const token = `${templateId}|${dialectKey(file.dialect)}`
    if (appliedToken.current === token) return
    appliedToken.current = token

    if (needsReread(config.dialect, file.dialect)) {
      // Once per pick: the re-read lands here again with the file read the saved way.
      if (rereadFor.current !== templateId) {
        rereadFor.current = templateId
        setDialect(config.dialect)
        return
      }
    }

    const result = applyTemplateConfig(config, file.columnCount, catalogue)
    setUnknown(result.unknown)
    updateMapping(() => result.draft)
  }, [
    file,
    templateId,
    ranked,
    catalogue,
    baseCurrency,
    fallbackCategory,
    updateMapping,
    setDialect,
  ])

  // A restored mapping has already answered ② and ③ — but only if it resolved into a
  // complete one; a template read against a narrower file has not, and must be finished.
  const continueTo = useCallback(() => {
    if (applied !== null && csv.mapping !== null) goTo('review')
    else next()
  }, [applied, csv.mapping, goTo, next])

  return { options, templates: ranked, signature, applied, unknown, continueTo }
}
