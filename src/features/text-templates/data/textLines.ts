/** The server reads at most this many lines of a text sample, each cut at `TEXT_LINE_MAX`. */
export const TEXT_LINE_MAX = 2000
export const TEXT_LINES_MAX = 2000

const LINE_BREAK = /\r\n|\r|\n/

/**
 * A text message as lines, split exactly as the server splits a delivered one — NUL dropped,
 * any line break, nothing trimmed — so a tapped line index names the same line on both sides.
 */
export const textLines = (text: string): string[] =>
  text
    .replaceAll('\u0000', '')
    .split(LINE_BREAK)
    .slice(0, TEXT_LINES_MAX)
    .map((line) => line.slice(0, TEXT_LINE_MAX))
