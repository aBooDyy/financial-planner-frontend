/**
 * The floating surface every menu, select and popover opens on: a hairline frame so it reads
 * on top of any background, and a soft deep shadow to lift it.
 */
export const MENU_SURFACE =
  'rounded-[16px] border border-fp-border bg-fp-surface text-fp-text shadow-[0_1px_2px_rgba(20,18,12,0.05),0_24px_48px_-20px_rgba(20,18,12,0.35)]'

/** One row of such a menu. */
export const MENU_ITEM =
  'rounded-[10px] py-[9px] text-[13.5px] font-semibold text-fp-text outline-hidden select-none focus:bg-fp-surface-2'

export const MENU_SEPARATOR = '-mx-[6px] my-[6px] h-px bg-fp-border'
