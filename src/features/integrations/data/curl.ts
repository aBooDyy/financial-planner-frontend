const CONTINUE = ' \\'

/** A working request the user can paste into a terminal to see a transaction arrive. */
export const sampleCurl = (endpoint: string): string =>
  [
    `curl -X POST '${endpoint}'${CONTINUE}`,
    `  -H 'Authorization: Bearer fpk_YOUR_KEY'${CONTINUE}`,
    `  -H 'Content-Type: application/json'${CONTINUE}`,
    `  -d '{"amount": "152.75", "currency": "SAR", "merchant": "Carrefour"}'`,
  ].join('\n')
