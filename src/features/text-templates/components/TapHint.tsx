import { Crosshair, Tag } from 'lucide-react'
import { NoteBox } from '#/components/dialog/NoteBox'
import type { ExtractField } from '#/features/text-templates/api/types'
import { LABEL_OFFSET_MAX } from '#/features/text-templates/data/labels'

type Props = {
  target: ExtractField | null
  labelFor: ExtractField | null
}

/** What the next tap on the sample does. */
export function TapHint({ target, labelFor }: Props) {
  if (labelFor)
    return (
      <NoteBox icon={<Tag />}>
        Tap the line that names the {labelFor} — up to {LABEL_OFFSET_MAX} lines
        from it.
      </NoteBox>
    )
  if (target)
    return (
      <NoteBox icon={<Crosshair />}>Tap the line with the {target}.</NoteBox>
    )
  return (
    <NoteBox tone="neutral">
      All tagged. Pick a tag to move it to another line.
    </NoteBox>
  )
}
