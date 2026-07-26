#!/usr/bin/env node
// T3-5 — Automated weekly waiver digest, no browser session required.
//
// The only way to get a digest email used to be a manual "Email me this
// week's picks" button in Season Hub, which needed the browser to hand it
// leagueRosters since Yahoo auth normally lives in an HttpOnly cookie. That
// button (and its backing route, pages/api/season/email-waiver-digest.js)
// has been removed now that this script covers it automatically. It reads
// the Yahoo token Hermes persists at ~/.hermes/auth.json (refreshing it if
// stale), fetches rosters itself, and sends the digest — so
// scripts/run_weekly.py can trigger it after the weekly stats refresh with
// no user in the loop.
//
// The waiver-advice prompt logic below is intentionally a near-duplicate of
// getWaiverAdvice() in pages/api/season/waiver-advice.js — that file imports
// via the `@/` alias, which only resolves under Next.js's webpack build, not
// plain Node. Keep the two in sync if the prompt or guardrails change.
//
// Usage: node scripts/send-waiver-digest.mjs [sport ...]   (defaults to mlb nba)

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'
import { getSportConfig, getPlayerFile } from '../src/config/sports.js'
import { formatStats, formatCurrentSeasonLine, formatRosterLine, formatRosterConfigLine, CURRENT_SEASON_REASONING_INSTRUCTION, IL_STASH_REASONING_INSTRUCTION } from '../src/ai/seasonStats.js'
import { normalizeName } from '../src/utils/playerName.js'
import { sendEmail } from '../src/server/email.js'

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const AUTH_PATH = 'C:\\Users\\athav\\AppData\\Local\\hermes\\auth.json'
const NOTIFY_TO = 'athavan.elangko@gmail.com'
const YAHOO_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2'

function loadEnvLocal() {
  const envPath = path.join(REPO_ROOT, '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}
loadEnvLocal()

const client = new Anthropic()

function extractMeta(arr) {
  if (!Array.isArray(arr)) return {}
  return Object.assign({}, ...arr.map(x => (typeof x === 'object' && !Array.isArray(x) ? x : {})))
}

function extractJSON(text) {
  const candidates = [
    text.replace(/```(?:json)?\n?([\s\S]*?)```/g, '$1').trim(),
    text,
  ]
  for (const candidate of candidates) {
    const match = candidate.match(/\{[\s\S]*\}/)
    if (!match) continue
    try { return JSON.parse(match[0]) } catch {}
  }
  throw new Error('Malformed JSON in model response')
}

async function yahooFetch(token, endpoint) {
  const res = await fetch(`${YAHOO_BASE}${endpoint}?format=json`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  })
  if (!res.ok) throw new Error(`Yahoo API ${res.status}: ${await res.text()}`)
  return res.json()
}

async function refreshYahooToken(refreshToken) {
  const credentials = Buffer.from(`${process.env.YAHOO_CLIENT_ID}:${process.env.YAHOO_CLIENT_SECRET}`).toString('base64')
  const res = await fetch('https://api.login.yahoo.com/oauth2/get_token', {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  })
  if (!res.ok) throw new Error(`Yahoo token refresh failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refreshToken,
    expires_at: Date.now() + data.expires_in * 1000,
  }
}

function saveYahooToken(auth, token) {
  auth.credential_pool.yahoo = { ...auth.credential_pool.yahoo, ...token }
  auth.updated_at = new Date().toISOString()
  fs.writeFileSync(AUTH_PATH, JSON.stringify(auth, null, 2))
}

async function getValidHermesToken() {
  const auth = JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8'))
  const stored = auth?.credential_pool?.yahoo
  if (!stored?.access_token) throw new Error(`No Yahoo token in ${AUTH_PATH}`)
  if (stored.expires_at - Date.now() < 5 * 60 * 1000) {
    const refreshed = await refreshYahooToken(stored.refresh_token)
    saveYahooToken(auth, refreshed)
    return refreshed
  }
  return stored
}

// Mirrors sync-rosters.js's user-team lookup (proven against this exact
// endpoint) but returns every {teamKey, leagueKey} for the sport instead of
// filtering to one league.
async function getUserLeaguesAndTeamKeys(token, sport) {
  const data = await yahooFetch(token, `/users;use_login=1/games;game_codes=${sport}/teams`)
  const userGames = data?.fantasy_content?.users?.[0]?.user?.[1]?.games
  const gameCount = userGames?.count ?? 0
  const out = []
  for (let i = 0; i < gameCount; i++) {
    const gameArr = userGames[i]?.game
    if (!gameArr || gameArr[0]?.code !== sport) continue
    if (gameArr[0]?.is_game_over) continue // skip completed/past-season leagues
    const teamsObj = gameArr[1]?.teams
    const teamCount = teamsObj?.count ?? 0
    for (let j = 0; j < teamCount; j++) {
      const meta = extractMeta(teamsObj[j]?.team?.[0])
      if (meta.team_key) out.push({ teamKey: meta.team_key, leagueKey: meta.team_key.split('.t.')[0] })
    }
  }
  return out
}

// Mirrors sync-rosters.js's per-league roster/standings parsing.
async function fetchLeagueRosters(token, leagueKey, userTeamKey, nameToId) {
  const [rostersRaw, standingsRaw] = await Promise.all([
    yahooFetch(token, `/league/${leagueKey}/teams/roster`),
    yahooFetch(token, `/league/${leagueKey}/standings`),
  ])

  const standingsTeams = standingsRaw?.fantasy_content?.league?.[1]?.standings?.[0]?.teams
  const standingsCount = standingsTeams?.count ?? 0
  const standingsMap = {}
  for (let i = 0; i < standingsCount; i++) {
    const t = standingsTeams[i]?.team
    const meta = extractMeta(t?.[0])
    const outcomes = t?.[2]?.team_standings?.outcome_totals
    standingsMap[meta.team_key] = {
      rank: t?.[2]?.team_standings?.rank ?? null,
      wins: Number(outcomes?.wins ?? 0),
      losses: Number(outcomes?.losses ?? 0),
      ties: Number(outcomes?.ties ?? 0),
    }
  }

  const teamsObj = rostersRaw?.fantasy_content?.league?.[1]?.teams
  const teamCount = teamsObj?.count ?? 0
  const teams = []
  for (let i = 0; i < teamCount; i++) {
    const t = teamsObj[i]?.team
    const meta = extractMeta(t?.[0])
    const playersObj = t?.[1]?.roster?.[0]?.players
    const playerCount = playersObj?.count ?? 0
    const roster = []
    for (let j = 0; j < playerCount; j++) {
      const p = playersObj[j]?.player
      const pm = Array.isArray(p?.[0]) ? extractMeta(p[0]) : {}
      const selMeta = Array.isArray(p?.[1]?.selected_position) ? extractMeta(p[1].selected_position) : {}
      const playerName = pm.name?.full ?? null
      roster.push({
        name: playerName,
        playerId: playerName ? (nameToId[normalizeName(playerName)] ?? null) : null,
        positions: pm.display_position ?? null,
        selectedPosition: selMeta.position ?? null,
      })
    }
    const standing = standingsMap[meta.team_key] ?? {}
    teams.push({
      teamKey: meta.team_key,
      teamName: meta.name ?? meta.team_key,
      rank: standing.rank !== undefined ? Number(standing.rank) : null,
      wins: standing.wins ?? 0,
      losses: standing.losses ?? 0,
      ties: standing.ties ?? 0,
      isUser: meta.team_key === userTeamKey,
      roster,
    })
  }
  return teams
}

// Mirrors pages/api/yahoo/settings.js's roster_positions parsing, reduced to
// just the IL/IL+ counts formatRosterConfigLine() needs.
async function fetchRosterConfig(token, leagueKey) {
  const data = await yahooFetch(token, `/league/${leagueKey}/settings`)
  const settings = data?.fantasy_content?.league?.[1]?.settings?.[0]
  const rosterPositions = settings?.roster_positions?.map(p => ({
    position: p.roster_position.position,
    count: Number(p.roster_position.count),
  })) ?? []
  return {
    ilSlots: rosterPositions.find(p => p.position === 'IL')?.count ?? null,
    ilPlusSlots: rosterPositions.find(p => p.position === 'IL+')?.count ?? null,
  }
}

// Near-duplicate of getWaiverAdvice() in pages/api/season/waiver-advice.js —
// see the file-level comment above for why this can't just import it.
async function buildWaiverAdvice({ sport, players, teams, userTeam, rosterConfig }) {
  const ownedNames = new Set()
  for (const team of teams) {
    for (const p of team.roster) if (p.name) ownedNames.add(normalizeName(p.name))
  }

  const playerById = {}
  const playerByName = {}
  for (const p of players) {
    playerById[p.id] = p
    playerByName[normalizeName(p.name)] = p
  }

  const userRosterLines = userTeam.roster.map(r => {
    const p = (r.playerId && playerById[r.playerId]) || playerByName[normalizeName(r.name)]
    return formatRosterLine(r, p, sport)
  })

  const topFAs = players
    .filter(p => !ownedNames.has(normalizeName(p.name)))
    .sort((a, b) => a.adp - b.adp)
    .slice(0, 25)
  const availableFANames = new Set(topFAs.map(p => normalizeName(p.name)))
  const availableFAs = topFAs.map(p => {
    const injuryTag = p.injury_risk ? ' ⚠️' : ''
    return `${p.name}(${p.yahoo_positions?.join('/') ?? '?'},ADP${p.adp?.toFixed(1)}${injuryTag}): ${formatStats(p, sport)}${formatCurrentSeasonLine(p, sport)}`
  })

  const sportConfig = getSportConfig(sport)
  const catLine = sportConfig.categories.map(c => c.label).join(', ')
  const sportLabel = sport === 'mlb' ? 'fantasy baseball' : 'fantasy basketball'

  const systemPrompt = `You are Billy Beane advising a ${sportLabel} GM on waiver wire moves.

Analyze the GM's roster against available free agents. Identify the team's weakest categories and recommend exactly 3 add/drop moves that address real gaps. Every "add" MUST be a player from the TOP AVAILABLE FREE AGENTS list below, copied exactly as spelled there — never recommend a player who isn't in that list, no matter how well-known they are, since a player not listed there is already rostered by someone in this league. Be specific — name exact players to add and drop. Explain each move in 2-3 sentences using Beane's direct, data-focused voice. Free agents marked CURRENT improving or slightly-improving are trending up in-season — weigh them as legitimate adds even if their ADP/prior-season profile looks ordinary. Treat "slightly-improving"/"slightly-declining" as real but modest movement, not noise — don't overstate it the way you would a full improving/declining trend.

Roster players are also tagged with their ADP — this is draft capital, not performance, and the two must not be conflated. Before proposing any drop, rank the FULL roster by realistic trade value to other GMs, not just by current-season production or raw ADP number. Trade value comes from a mix of signals — draft capital, prospect pedigree, notable international/rookie signings, name recognition, role/opportunity — and a player can hold real trade value even with a middling ADP or a rough current-season line. Struggling, or a modest ADP, is not the same as "no trade value" — do not conflate the two. Always propose dropping the roster's actual lowest-trade-value asset (a true replacement-level or streaming piece nobody would trade for) ahead of a player a rival GM would still want, even if that lower-value player's stat line currently looks fine. When no truly replacement-level option exists and you must propose dropping a player who still carries real trade value, say explicitly in the reason that the value would be better preserved by shopping him in a trade once that's an option, rather than releasing him to waivers for nothing.

${CURRENT_SEASON_REASONING_INSTRUCTION}

${IL_STASH_REASONING_INSTRUCTION}

Reply ONLY with raw JSON — no markdown, no extra text:
{"headline":"1 sentence framing what this team most needs","moves":[{"add":"Player Name","drop":"Player Name or null if roster spot open","priority":"must-add|consider|speculative","reason":"2-3 sentences Beane voice"}]}`

  const userPrompt = `${sportLabel} league · Categories: ${catLine}${formatRosterConfigLine(rosterConfig)}

MY ROSTER (${userTeam.teamName}):
${userRosterLines.join('\n')}

TOP AVAILABLE FREE AGENTS (by projected rank):
${availableFAs.join('\n')}

Recommend 3 waiver wire moves.`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 900,
    system: [{ type: 'text', text: systemPrompt }],
    messages: [{ role: 'user', content: userPrompt }],
  })
  const result = extractJSON(message.content[0]?.text ?? '')
  if (Array.isArray(result.moves)) {
    result.moves = result.moves.filter(m => availableFANames.has(normalizeName(m.add)))
  }
  return result
}

// Near-duplicate of getLeaguePulse() in pages/api/season/league-pulse.js —
// same reason as buildWaiverAdvice() above: that file imports via the `@/`
// alias, which only resolves under Next.js's build. Only used here for its
// tradeOpportunities — the digest email doesn't need the full pulse.
async function buildLeaguePulse({ sport, players, teams, rosterConfig }) {
  if (teams.length < 2) return { tradeOpportunities: [] }

  const playerByName = {}
  for (const p of players) playerByName[normalizeName(p.name)] = p

  function lineFor(entry) {
    const p = playerByName[normalizeName(entry.name)]
    return formatRosterLine(entry, p, sport)
  }

  const teamsSorted = [...teams].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
  const standingsLines = teamsSorted.map(t =>
    `${t.rank != null ? `#${t.rank}` : '?'} ${t.teamName}${t.isUser ? ' (ME)' : ''} — W${t.wins ?? 0}/L${t.losses ?? 0}${t.ties ? `/T${t.ties}` : ''}`
  )
  const rosterLines = teamsSorted.map(team =>
    `${team.teamName}${team.isUser ? ' (ME)' : ''}:\n${team.roster.map(lineFor).join('\n')}`
  )

  const sportConfig = getSportConfig(sport)
  const catLine = sportConfig.categories
    .map(c => `${c.label}${sportConfig.lowerIsBetter?.includes(c.id) ? '↓' : ''}`)
    .join(', ')
  const sportLabel = sport === 'mlb' ? 'fantasy baseball' : 'fantasy basketball'

  const systemPrompt = `You are Billy Beane delivering a weekly league-wide pulse check to a ${sportLabel} GM (me).

Using the standings and every team's roster, identify: (1) which teams are genuinely dominating (strong record backed by real roster quality, not just early-season luck), (2) which teams are weak or clearly rebuilding (bad record and/or thin roster), and (3) which specific teams look like plausible trade partners for ME right now — teams whose roster strengths/needs could complement mine (they're weak where I'm strong, or strong where I have a surplus), or contenders/rebuilders whose incentives point toward being open to a deal. Be specific about why a team is a fit, not generic. Don't force a trade partner if none genuinely stand out.

Reply ONLY with raw JSON — no markdown, no extra text:
{"headline":"1-2 sentence framing of the league's current state","dominating":[{"team":"Team Name","note":"1 sentence why"}],"rebuilding":[{"team":"Team Name","note":"1 sentence why"}],"tradeOpportunities":[{"team":"Team Name","note":"1-2 sentences on the specific fit for me"}]}`

  const userPrompt = `${sportLabel} league · Categories: ${catLine}${formatRosterConfigLine(rosterConfig)}

STANDINGS:
${standingsLines.join('\n')}

ROSTERS:
${rosterLines.join('\n\n')}

Give me this week's league pulse.`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system: [{ type: 'text', text: systemPrompt }],
    messages: [{ role: 'user', content: userPrompt }],
  })
  return extractJSON(message.content[0]?.text ?? '')
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
}

// Digest email template, with a Trade Opportunities section sourced from
// League Pulse below the waiver picks.
function buildDigestHtml(leagueName, week, headline, moves, tradeOpportunities) {
  const rows = moves.slice(0, 3).map(m => `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #2a2a2a;">
        <p style="margin:0;font-size:14px;color:#e5e5e5;">
          <strong style="color:#22c55e;">+ ${m.add}</strong>${m.drop ? ` <span style="color:#666;">&middot;</span> <strong style="color:#f87171;">&minus; ${m.drop}</strong>` : ''}
        </p>
        <p style="margin:6px 0 0;font-size:13px;color:#999;line-height:1.5;">${m.reason}</p>
      </td>
    </tr>`).join('')

  const tradeSection = tradeOpportunities?.length ? `
      <div style="margin-top:24px;padding-top:20px;border-top:1px solid #2a2a2a;">
        <p style="color:#3b82f6;font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;margin:0 0 12px;">Trade Opportunities</p>
        ${tradeOpportunities.map(t => `
        <p style="margin:0 0 10px;font-size:13px;color:#999;line-height:1.5;">
          <strong style="color:#e5e5e5;">${t.team}:</strong> ${t.note}
        </p>`).join('')}
      </div>` : ''

  return `<!DOCTYPE html>
<html>
  <body style="background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:32px 16px;margin:0;">
    <div style="max-width:480px;margin:0 auto;">
      <p style="color:#3b82f6;font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;margin:0 0 6px;">${leagueName}</p>
      <h1 style="color:#fff;font-size:20px;margin:0 0 16px;">Week ${week} Waiver Wire Picks</h1>
      ${headline ? `<p style="color:#999;font-size:13px;font-style:italic;margin:0 0 20px;line-height:1.5;">${headline}</p>` : ''}
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      ${tradeSection}
      <p style="color:#555;font-size:11px;margin-top:28px;">&mdash; Beane, via PocketBeane (automated weekly digest)</p>
    </div>
  </body>
</html>`
}

async function sendDigestForLeague({ token, sport, leagueKey, userTeamKey }) {
  const players = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'src/data', getPlayerFile(sport)), 'utf8'))
  const nameToId = {}
  for (const p of players) nameToId[normalizeName(p.name)] = p.id

  const [teams, rosterConfig] = await Promise.all([
    fetchLeagueRosters(token, leagueKey, userTeamKey, nameToId),
    fetchRosterConfig(token, leagueKey),
  ])

  const userTeam = teams.find(t => t.isUser)
  if (!userTeam) {
    console.log(`[send-waiver-digest] ${sport}/${leagueKey}: no user team found, skipping`)
    return
  }

  const advice = await buildWaiverAdvice({ sport, players, teams, userTeam, rosterConfig })

  // League Pulse's trade opportunities are a value-add, not the point of the
  // email — a failure here (the model occasionally returns malformed JSON)
  // must never block the waiver picks from going out.
  let tradeOpportunities = []
  try {
    const pulse = await buildLeaguePulse({ sport, players, teams, rosterConfig })
    tradeOpportunities = pulse.tradeOpportunities ?? []
  } catch (err) {
    console.error(`[send-waiver-digest] ${sport}/${leagueKey}: league pulse failed, sending digest without it —`, err.message)
  }

  const week = getWeekNumber(new Date())
  const html = buildDigestHtml(userTeam.teamName, week, advice.headline, advice.moves ?? [], tradeOpportunities)
  const subject = `Your Week ${week} Waiver Wire Picks — ${userTeam.teamName}`

  await sendEmail({ to: NOTIFY_TO, subject, html, type: 'waiver-digest-cron' })
  console.log(`[send-waiver-digest] sent digest for ${sport}/${leagueKey} (${userTeam.teamName}) to ${NOTIFY_TO}`)
}

async function main() {
  const sports = process.argv.slice(2).length ? process.argv.slice(2) : ['mlb', 'nba']
  const token = await getValidHermesToken()

  for (const sport of sports) {
    let leagueTeams
    try {
      leagueTeams = await getUserLeaguesAndTeamKeys(token, sport)
    } catch (err) {
      console.error(`[send-waiver-digest] ${sport}: couldn't list leagues —`, err.message)
      continue
    }
    const seenLeagues = new Set()
    for (const { teamKey, leagueKey } of leagueTeams) {
      if (seenLeagues.has(leagueKey)) continue
      seenLeagues.add(leagueKey)
      try {
        await sendDigestForLeague({ token, sport, leagueKey, userTeamKey: teamKey })
      } catch (err) {
        console.error(`[send-waiver-digest] ${sport}/${leagueKey} failed:`, err.message)
      }
    }
  }
}

main().catch(err => {
  console.error('[send-waiver-digest] fatal:', err.message)
  process.exit(1)
})
