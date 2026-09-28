import { cn } from '#/lib/utils'

export type SyncGlyph = 'sync' | 'check' | 'alert'

type Props = {
  glyph: SyncGlyph
  /** Turns the sync arrows; ignored by the other glyphs. */
  spinning?: boolean
  size?: number
  className?: string
}

// Lucide's cloud-sync, cloud-check and cloud-alert (ISC). Drawn by hand because the arrows
// turn on their own, around the centre of the arcs they sit on.
const SYNC_CLOUD =
  'M20.996 15.251A4.5 4.5 0 0 0 17.495 8h-1.79a7 7 0 1 0-12.709 5.607'
const SYNC_ARROWS = [
  'm17 18-1.535 1.605a5 5 0 0 1-8-1.5',
  'M17 22v-4h-4',
  'M7 10v4h4',
  'm7 14 1.535-1.605a5 5 0 0 1 8 1.5',
]
const CHECK_CLOUD =
  'M5.516 16.07A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 3.501 7.327'
const ALERT_CLOUD = 'M8.128 16.949A7 7 0 1 1 15.71 8h1.79a1 1 0 0 1 0 9h-1.642'

const ARROWS_ORIGIN = {
  transformBox: 'view-box',
  transformOrigin: '12px 16px',
} as const
const ICON_ORIGIN = {
  transformBox: 'view-box',
  transformOrigin: '12px 12px',
} as const

const ENTER =
  '[animation:fp-pop-in-soft_.3s_ease-out] motion-reduce:[animation:none]'
const DRAW =
  '[stroke-dasharray:1] [animation:fp-stroke-draw_.45s_ease-out_.12s_both] motion-reduce:[animation:none]'

function SyncMark({ spinning }: { spinning: boolean }) {
  return (
    <>
      <path d={SYNC_CLOUD} />
      <g
        style={ARROWS_ORIGIN}
        className={cn(
          spinning &&
            'animate-spin [animation-duration:1.4s] motion-reduce:animate-none',
        )}
      >
        {SYNC_ARROWS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </>
  )
}

function CheckMark() {
  return (
    <>
      <path d={CHECK_CLOUD} />
      <path d="m17 15-5.5 5.5L9 18" pathLength={1} className={DRAW} />
    </>
  )
}

function AlertMark() {
  return (
    <g
      style={ICON_ORIGIN}
      className="[animation:fp-nudge_.5s_ease-in-out_.15s] motion-reduce:[animation:none]"
    >
      <path d={ALERT_CLOUD} />
      <path d="M12 12v4" pathLength={1} className={DRAW} />
      <path d="M12 20h.01" />
    </g>
  )
}

/**
 * The nav's sync cloud. Each glyph pops in when it takes over, so finishing a sync reads as
 * the arrows giving way to a drawn check, or to an alert that nudges once.
 */
export function SyncCloudGlyph({
  glyph,
  spinning = false,
  size = 20,
  className,
}: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <g key={glyph} style={ICON_ORIGIN} className={ENTER}>
        {glyph === 'sync' ? <SyncMark spinning={spinning} /> : null}
        {glyph === 'check' ? <CheckMark /> : null}
        {glyph === 'alert' ? <AlertMark /> : null}
      </g>
    </svg>
  )
}
