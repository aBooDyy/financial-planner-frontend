/**
 * Changing one set-aside by hand from its bill's or goal's history. Each is the set-aside slice's
 * own write, and then the stored plan is rewritten quietly, as Add money does: having more or
 * less set aside changes what later paydays need to.
 */
import { db } from '#/db/db'
import { billOwner, goalOwner } from '#/features/planned/data/owners'
import { requestPlanRecalc } from '#/features/planned/data/recalcRequests'
import { releaseSetAsides } from '#/features/setAsides/data/batches'
import {
  deleteSetAside,
  unreleaseSetAside,
  updateSetAside,
} from '#/features/setAsides/data/mutations'
import type { SetAsidePatch } from '#/features/setAsides/data/mutations'
import { MoneyActionError } from './errors'

async function replanOwnerOf(id: string): Promise<() => void> {
  const row = await db.setAsides.get(id)
  if (!row || row.deleted !== 0) throw new MoneyActionError('not_found')
  const owner = row.goalId
    ? goalOwner(row.goalId)
    : row.billId
      ? billOwner(row.billId)
      : null
  return () => {
    if (owner) requestPlanRecalc(owner, { quiet: true })
  }
}

export async function editSetAside(
  id: string,
  patch: SetAsidePatch,
): Promise<void> {
  const replan = await replanOwnerOf(id)
  await updateSetAside(id, patch)
  replan()
}

/** The money is free again, and the record stays as "Taken back". */
export async function takeBackSetAside(id: string): Promise<void> {
  const replan = await replanOwnerOf(id)
  await releaseSetAsides([{ id }])
  replan()
}

/** Undoes a take back: the same record is set aside again. */
export async function setAsideAgain(id: string): Promise<void> {
  const replan = await replanOwnerOf(id)
  await unreleaseSetAside(id)
  replan()
}

/** A record made by mistake: it goes, as if it had never been set aside. */
export async function removeSetAside(id: string): Promise<void> {
  const replan = await replanOwnerOf(id)
  await deleteSetAside(id)
  replan()
}
