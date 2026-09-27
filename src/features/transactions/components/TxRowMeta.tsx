import type { TxRow } from '#/features/transactions/data/selectors'
import { TX_TAG_LABEL } from '#/features/transactions/data/selectors'
import { SeparatedItem } from '#/components/SeparatedItem'
import { SeparatedWrap } from '#/components/SeparatedWrap'
import { TagPill } from '#/components/TagPill'

const PATH_GAP = 9
const GROUP_GAP = 15

const DOT = '·'
const PIPE = <span className="text-fp-border-strong">|</span>

/** `continued` when an earlier item of the same path precedes these. */
function PathItems({
  path,
  continued,
}: {
  path: string[]
  continued?: boolean
}) {
  return path.map((name, i) => (
    <SeparatedItem key={i} separator={continued || i > 0 ? DOT : undefined}>
      <span className="truncate">{name}</span>
    </SeparatedItem>
  ))
}

/**
 * The tag, category path and wallet path under a row's title. Short of room it breaks
 * between category and wallet first, then within each path.
 */
export function TxRowMeta({ row }: { row: TxRow }) {
  const [walletHead, ...walletTail] = row.walletPath
  return (
    <SeparatedWrap gap={GROUP_GAP} className="text-[12px] text-fp-text-3">
      <SeparatedItem>
        <SeparatedWrap gap={PATH_GAP}>
          {row.tag ? (
            <SeparatedItem>
              <TagPill
                label={TX_TAG_LABEL[row.tag]}
                tone={row.tag === 'obligation' ? 'neutral' : 'accent'}
              />
            </SeparatedItem>
          ) : null}
          <PathItems path={row.catPath} />
        </SeparatedWrap>
      </SeparatedItem>
      <SeparatedItem separator={PIPE}>
        <SeparatedWrap gap={PATH_GAP}>
          <SeparatedItem>
            <span
              className="me-[6px] h-[7px] w-[7px] flex-none rounded-[2px]"
              style={{ background: row.walletColor }}
            />
            <span className="truncate">{walletHead}</span>
          </SeparatedItem>
          <PathItems path={walletTail} continued />
        </SeparatedWrap>
      </SeparatedItem>
    </SeparatedWrap>
  )
}
