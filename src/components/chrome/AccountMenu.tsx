import { Link } from '@tanstack/react-router'
import { CircleHelp, LogOut, Settings } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import type { User } from '#/features/auth/api/types'

type Props = {
  user: User
  initials: string
  onSignOut: () => void
}

const ITEM =
  'gap-[10px] rounded-[9px] px-[10px] py-[9px] text-[13.5px] font-semibold text-fp-text'

export function AccountMenu({ user, initials, onSignOut }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Account"
          className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-fp-accent-soft text-[13px] font-bold text-fp-accent-ink data-[state=open]:ring-2 data-[state=open]:ring-fp-accent"
        >
          {initials}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-[236px] rounded-[14px] border-fp-border bg-fp-surface p-2 shadow-fp"
      >
        <DropdownMenuLabel className="mb-[6px] flex items-center gap-[11px] border-b border-fp-border px-2 pt-[6px] pb-3 font-normal">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="bg-fp-accent-soft text-[14px] font-bold text-fp-accent-ink">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-bold">{user.name}</div>
            <div className="truncate text-[12px] text-fp-text-3">
              {user.email}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuItem asChild className={ITEM}>
          <Link to="/settings">
            <Settings size={17} strokeWidth={1.7} />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className={ITEM}>
          <CircleHelp size={17} strokeWidth={1.7} />
          <span>Help &amp; feedback</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="mx-1 my-[6px] bg-fp-border" />
        <DropdownMenuItem
          className={`${ITEM} text-fp-danger focus:text-fp-danger`}
          onSelect={onSignOut}
        >
          <LogOut size={17} strokeWidth={1.7} />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
