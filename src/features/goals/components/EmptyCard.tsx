export function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-[16px] border border-dashed border-fp-border-strong px-4 py-6 text-[13px] leading-normal text-fp-text-3">
      {text}
    </div>
  )
}
