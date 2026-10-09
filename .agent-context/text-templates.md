# Text templates (frontend)

`features/text-templates/` — the tap-to-learn kit for reading lines of text: an email's body
([email-sync.md](email-sync.md)) or a text message a webhook key received
([integrations.md](integrations.md), text rules). Both slices depend on it; it imports
neither. The server learns the template from the user's taps — the client never builds one —
and reads it back (backend: `email_sync_services/extraction/`).

| Layer | Files |
| --- | --- |
| `api/types.ts` | The template, the reading (`Extraction`, `FieldReading`), picks, learn options, learned labels, `LearnRequest<TSample>`, `Learned`; their wire shapes and mappers (`toTemplate(Wire)`, `toExtraction`, `toPicksWire`, `toLearnOptionsWire`, `toLearned`). `TextSample = { bodyLines }` — any sample a tap lands on; `EmailSample` satisfies it. |
| `data/` | `mapping.ts` (the `Mapping<TSample>` of picks + options, the target hop, `learnRequestOf`, `signatureOf`, `pickForLine`), `tapping.ts` (the shared sub-reducer below), `labels.ts`, `fields.ts`, `readings.ts`, `describe.ts` (`describeTemplate`), `terms.ts` (`cleanTerms`, `TERM_MAX`), `textLines.ts` |
| `components/` | `SampleLines` (optional `heading`, a `noun`), `FieldTargetChips`, `TapHint`, `FieldLabels` → `FieldLabelRow` → `LabelChip`, `NumberChoice`, `ReadingOptions` + `ReadingSummary` (both take a `noun`: "email", "message"), `TermsInput`, `EditorSection` |

**The tapping sub-reducer.** `Tapping<TSample> = { mapping, target, labelFor }` and
`tappingReducer(tapping, action)` own every transition of the taps: `target`, `pick` (and the
hop amount → currency → nothing), `setPick` (which number on a line, keeping a chosen label
line), `clearPick`, `labelMode` / `pickLabel` / `clearLabel`, `decimal`, `currency` (a fixed
currency drops the currency target). `tappingFor(template)` starts one; `withSample` puts a
new sample in and drops every pick. Email's `OpenRule` *is* a `Tapping` and forwards these
actions (`isTappingAction`); an integration's open text rule holds one in `tapping` and wraps
them as `{type: 'tap', action}` (its own `target` action is the JSON rule's).

**`textLines(text)`** splits a text sample exactly like the server's `text_lines`: NUL
dropped, any line break, nothing trimmed, 2 000 lines of at most 2 000 chars. Tapped line
indices only mean the same line on both sides because of it.

`useDebouncedCall` (the learn and test calls that follow an editor) lives in `src/hooks/`.

Tests: `data/labels.test.ts`, `data/textLines.test.ts`, `components/LabelChip.test.tsx`,
`components/RuleMapping.test.tsx` (`SampleLines` marks and taps, `NumberChoice`); the reducer is
exercised through email-sync's `ruleEditorState.test.ts` and integrations' `textRules.test.ts`.
