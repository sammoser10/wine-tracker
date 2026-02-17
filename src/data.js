import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

// ── Auth ──
export function useAuth() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
      if (session?.user) loadProfile(session.user.id)
      else setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      if (session?.user) loadProfile(session.user.id)
      else { setProfile(null); setAuthLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadProfile = async (uid) => {
    const { data } = await supabase.from('wt_users').select('*').eq('id', uid).single()
    if (data) setProfile({ id: data.id, name: data.name, avatar: data.avatar, joinedAt: data.joined_at })
    setAuthLoading(false)
  }

  const signUp = async (email, password, name, avatar) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error: error.message }
    if (data.user) {
      const { error: profErr } = await supabase.from('wt_users').insert({
        id: data.user.id, name, avatar, joined_at: new Date().toISOString()
      })
      if (profErr) return { error: profErr.message }
      setProfile({ id: data.user.id, name, avatar, joinedAt: new Date().toISOString() })
    }
    return { error: null }
  }

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return { user, profile, authLoading, signUp, signIn, signOut }
}

// ── Load all data ──
export function useWineData() {
  const [users, setUsers] = useState({})
  const [entries, setEntries] = useState([])
  const [collection, setCollection] = useState([])
  const [reactions, setReactions] = useState({})
  const [comments, setComments] = useState({})
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    try {
      const [uRes, eRes, cRes, rRes, cmRes] = await Promise.all([
        supabase.from('wt_users').select('*'),
        supabase.from('wt_entries').select('*').order('created_at', { ascending: false }),
        supabase.from('wt_collection').select('*').order('added_at', { ascending: false }),
        supabase.from('wt_reactions').select('*'),
        supabase.from('wt_comments').select('*').order('created_at', { ascending: true }),
      ])

      const uMap = {}
      ;(uRes.data || []).forEach(u => { uMap[u.id] = { id: u.id, name: u.name, avatar: u.avatar, joinedAt: u.joined_at } })
      setUsers(uMap)

      setEntries((eRes.data || []).map(e => ({
        id: e.id, userId: e.user_id, kind: e.kind, name: e.name, type: e.type,
        producer: e.producer, region: e.region, grape: e.grape, vintage: e.vintage,
        notes: e.notes, rating: e.rating, price: e.price, quantity: e.quantity,
        store: e.store, date: e.date, fromCollection: e.from_collection, createdAt: e.created_at,
      })))

      setCollection((cRes.data || []).map(c => ({
        id: c.id, userId: c.user_id, name: c.name, type: c.type, producer: c.producer,
        region: c.region, vintage: c.vintage, price: c.price, store: c.store,
        remaining: c.remaining, total: c.total, addedAt: c.added_at,
      })))

      const rMap = {}
      ;(rRes.data || []).forEach(r => {
        if (!rMap[r.entry_id]) rMap[r.entry_id] = []
        rMap[r.entry_id].push(r.user_id)
      })
      setReactions(rMap)

      const cmMap = {}
      ;(cmRes.data || []).forEach(c => {
        if (!cmMap[c.entry_id]) cmMap[c.entry_id] = []
        cmMap[c.entry_id].push({ id: c.id, userId: c.user_id, text: c.text, createdAt: c.created_at })
      })
      setComments(cmMap)
    } catch (e) {
      console.error('Load error:', e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    const channel = supabase.channel('wine-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wt_users' }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wt_entries' }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wt_collection' }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wt_reactions' }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wt_comments' }, () => loadAll())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [loadAll])

  return { users, entries, collection, reactions, comments, loading, reload: loadAll }
}

// ── Mutations ──
export async function addEntry(entry) {
  const { error } = await supabase.from('wt_entries').insert({
    id: entry.id, user_id: entry.userId, kind: entry.kind, name: entry.name,
    type: entry.type, producer: entry.producer || '', region: entry.region || '',
    grape: entry.grape || '', vintage: entry.vintage || '', notes: entry.notes || '',
    rating: entry.rating || 0, price: entry.price, quantity: entry.quantity || 1,
    store: entry.store || '', date: entry.date, from_collection: entry.fromCollection || null,
    created_at: entry.createdAt,
  })
  if (error) console.error('addEntry error:', error)
}

export async function deleteEntry(id) {
  // Delete reactions and comments first, then the entry
  await supabase.from('wt_reactions').delete().eq('entry_id', id)
  await supabase.from('wt_comments').delete().eq('entry_id', id)
  const { error } = await supabase.from('wt_entries').delete().eq('id', id)
  if (error) console.error('deleteEntry error:', error)
}

export async function addBottle(bottle) {
  const { error } = await supabase.from('wt_collection').insert({
    id: bottle.id, user_id: bottle.userId, name: bottle.name, type: bottle.type,
    producer: bottle.producer || '', region: bottle.region || '', vintage: bottle.vintage || '',
    price: bottle.price, store: bottle.store || '', remaining: bottle.remaining, total: bottle.total,
    added_at: bottle.addedAt,
  })
  if (error) console.error('addBottle error:', error)
}

export async function decrementBottle(id) {
  const { data } = await supabase.from('wt_collection').select('remaining').eq('id', id).single()
  if (data) {
    await supabase.from('wt_collection').update({ remaining: Math.max(0, data.remaining - 1) }).eq('id', id)
  }
}

export async function toggleReaction(entryId, userId) {
  const { data } = await supabase.from('wt_reactions').select('id').eq('entry_id', entryId).eq('user_id', userId)
  if (data && data.length > 0) {
    await supabase.from('wt_reactions').delete().eq('entry_id', entryId).eq('user_id', userId)
  } else {
    await supabase.from('wt_reactions').insert({ entry_id: entryId, user_id: userId })
  }
}

export async function addComment(entryId, userId, text) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
  await supabase.from('wt_comments').insert({
    id, entry_id: entryId, user_id: userId, text, created_at: new Date().toISOString(),
  })
}
