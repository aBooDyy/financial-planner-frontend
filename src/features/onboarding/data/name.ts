/** The greeting name: the first word of whatever the user typed. */
export const firstNameOf = (name: string): string =>
  name.trim().split(/\s+/)[0] ?? ''
