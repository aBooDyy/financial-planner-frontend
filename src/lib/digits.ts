const ARABIC_INDIC = /[٠-٩۰-۹]/g

/** Arabic-Indic (٠–٩) and Extended Arabic-Indic (۰–۹) digits → ASCII 0–9, one for one. */
export const asciiDigits = (value: string): string =>
  // Both blocks start at a multiple of 16, so the low nibble is the digit's value.
  value.replace(ARABIC_INDIC, (digit) =>
    String((digit.codePointAt(0) ?? 0) & 0xf),
  )
