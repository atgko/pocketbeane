// Daily-cached Sleeper player map. Sleeper's docs are explicit: /players/nfl
// is a ~2.5MB payload and should be fetched AT MOST ONCE PER DAY, cached on
// your own servers — never call it per-request. This module is the only
// caller of client.js's getPlayers(), and everything else in the Sleeper
// adapter resolves player_ids through resolvePlayer() below instead of ever
// touching the raw endpoint.

import fs from 'fs'
import path from 'path'
import os from 'os'
import { getPlayers } from './client'

const CACHE_PATH = path.join(os.tmpdir(), 'pocketbeane-sleeper-players-nfl.json')
const MAX_AGE_MS = 24 * 60 * 60 * 1000

// In-process cache — avoids even a disk read on every call within one warm
// server instance, on top of the disk cache below.
let memoryCache = null

function readDiskCache() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
    if (Date.now() - parsed.fetchedAt < MAX_AGE_MS) return parsed
  } catch {
    // No cache file yet, or it's corrupt/unreadable — treat as a cold cache.
  }
  return null
}

function writeDiskCache(players) {
  const payload = { fetchedAt: Date.now(), players }
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(payload))
  } catch (err) {
    // Non-fatal — worst case we just re-fetch next call instead of reading
    // a persisted cache. Not worth failing the caller over.
    console.error('[sleeper/playerMap] failed to write disk cache:', err.message)
  }
  return payload
}

// Caveat: os.tmpdir() persists across warm invocations (Vercel Fluid
// Compute reuses instances) but resets on cold start/redeploy. Worst case
// that's one extra /players/nfl fetch per cold start — nowhere near
// Sleeper's "once a day" limit in practice, and this app has no existing
// durable storage (no DB, no Blob/KV — see src/platforms plan doc) to
// upgrade to without adding a new infra dependency for this alone. If
// PocketBeane starts seeing high cold-start-frequency prod traffic, Vercel
// Blob would be the correct next step.
export async function getPlayerMap(forceRefresh = false) {
  if (!forceRefresh && memoryCache && Date.now() - memoryCache.fetchedAt < MAX_AGE_MS) {
    return memoryCache.players
  }

  if (!forceRefresh) {
    const disk = readDiskCache()
    if (disk) {
      memoryCache = disk
      return disk.players
    }
  }

  const players = await getPlayers('nfl')
  memoryCache = writeDiskCache(players)
  return players
}

// player.<player_id> also carries yahoo_id/espn_id/rotowire_id/
// sportradar_id cross-reference fields — a natural hook for reconciling
// Sleeper players against PocketBeane's own src/data/nfl_players.json
// (currently matched by name-normalization only, same as the Yahoo sync
// routes). Not implemented here — flagged for a future ticket, per the
// original brief.
export async function resolvePlayer(playerId) {
  const players = await getPlayerMap()
  return players?.[playerId] ?? null
}
