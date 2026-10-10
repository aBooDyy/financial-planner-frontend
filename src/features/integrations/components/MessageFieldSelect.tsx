import { FormRow } from '#/components/FormRow'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import type { MessageField } from '#/features/integrations/data/messageFields'

/** Radix gives no item an empty value, so the plain-text body has a stand-in. */
const WHOLE_BODY = '$body'
const PREVIEW_MAX = 48

type Props = {
  fields: MessageField[]
  textPath: string | null
  onChange: (path: string | null) => void
  error?: string | null
}

const previewOf = (text: string) => {
  const line = text.replace(/\s+/g, ' ').trim()
  return line.length > PREVIEW_MAX ? `${line.slice(0, PREVIEW_MAX)}…` : line
}

/**
 * Where the rule finds its message: the whole body of a plain-text delivery, or one string
 * field of a JSON one — `{"message": "Purchase of SAR 38.50 …"}`.
 */
export function MessageFieldSelect({
  fields,
  textPath,
  onChange,
  error,
}: Props) {
  const missing =
    textPath !== null && !fields.some((field) => field.path === textPath)

  return (
    <FormRow
      id="text-rule-path"
      label="Read the message from"
      error={error}
      help={
        textPath === null
          ? 'Deliveries whose whole body is the message.'
          : 'JSON deliveries that carry the message in this field.'
      }
    >
      <Select
        value={textPath ?? WHOLE_BODY}
        onValueChange={(value) => onChange(value === WHOLE_BODY ? null : value)}
      >
        <SelectTrigger
          id="text-rule-path"
          aria-invalid={error ? true : undefined}
          className="w-full"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={WHOLE_BODY}>
            The whole body (plain text)
          </SelectItem>
          {missing ? (
            <SelectItem value={textPath}>
              <span className="font-mono">{textPath}</span>
              <span className="text-fp-text-3"> · not in this sample</span>
            </SelectItem>
          ) : null}
          {fields.map((field) => (
            <SelectItem key={field.path} value={field.path}>
              <span className="font-mono">{field.path}</span>
              <span dir="auto" className="text-fp-text-3">
                {' '}
                · {previewOf(field.text)}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormRow>
  )
}
