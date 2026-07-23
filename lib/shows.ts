import { supabase } from './supabase'

/**
 * All shows the user can access: shows they own plus shows they're a member of.
 * Used by the dashboard and GlobalSearch so the two can never drift.
 */
export async function fetchAccessibleShows(userId: string) {
  const [{ data: owned, error: ownedErr }, { data: memberRows, error: memberErr }] = await Promise.all([
    supabase.from('shows').select('*').eq('owner_id', userId).order('created_at', { ascending: false }),
    supabase.from('show_members').select('show_id').eq('user_id', userId),
  ])
  if (ownedErr || memberErr) throw ownedErr || memberErr

  const ownedList = owned || []
  const memberIds = (memberRows || [])
    .map(m => m.show_id)
    .filter(id => !ownedList.some(s => s.id === id))

  let memberShows: any[] = []
  if (memberIds.length > 0) {
    const { data, error } = await supabase.from('shows').select('*').in('id', memberIds)
    if (error) throw error
    memberShows = data || []
  }

  return { owned: ownedList, member: memberShows, all: [...ownedList, ...memberShows] }
}
