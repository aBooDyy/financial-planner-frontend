/** A pasted payload tidied for reading; left as typed when it is not JSON. */
export function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}
