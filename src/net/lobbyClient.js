import { create } from 'zustand'

import { addSnapshot, newTrack } from './snapshots'

/**
 * Connection to the lobby server (see the server's realtime.js for the protocol).
 * Joining happens automatically: the server puts us in a lobby with room. If the
 * server can't be reached the game still plays, solo, and keeps retrying.
 */

/** The server's HTTP address; VITE_SERVER_URL in .env overrides the local default. */
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000'
const WS_URL = `${SERVER_URL.replace(/^http/, 'ws').replace(/\/+$/, '')}/ws`
/** Waits before each reconnect attempt; the last repeats. */
const RETRY_MS = [1000, 2000, 5000, 10000]

/**
 * status: 'connecting' | 'online' | 'offline'
 * lobby: { id, name, max } while online
 * players: the *other* players in our lobby, by id: { name, avatar, sword }
 */
export const useLobby = create(() => ({ status: 'connecting', lobby: null, selfId: null, players: {} }))

/**
 * Every other player's movement track, by id (see snapshots.js), for smooth
 * playback in RemotePlayers. Updated 20 times a second, so it's kept out of React
 * state and read from frame loops.
 */
export const remoteStates = new Map()

let socket = null
let profile = { name: 'Player', avatar: null, sword: null }
let stopped = true
let retries = 0
let retryTimer = null

function send(message) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
}

function profileOf(player, previous) {
  // Keep the same avatar object when it hasn't changed, so the model isn't rebuilt
  // just because the player switched swords.
  const avatar =
    previous && JSON.stringify(previous.avatar) === JSON.stringify(player.avatar) ? previous.avatar : player.avatar
  return { name: player.name, avatar, sword: player.sword }
}

function handle(message) {
  const { players, selfId } = useLobby.getState()
  switch (message.t) {
    case 'welcome': {
      remoteStates.clear()
      const next = {}
      for (const player of message.players) {
        next[player.id] = profileOf(player)
        remoteStates.set(player.id, newTrack(player.p, player.sw, performance.now()))
      }
      useLobby.setState({ status: 'online', lobby: message.lobby, selfId: message.id, players: next })
      break
    }
    case 'join':
      remoteStates.set(message.player.id, newTrack(message.player.p, message.player.sw, performance.now()))
      useLobby.setState({ players: { ...players, [message.player.id]: profileOf(message.player) } })
      break
    case 'leave': {
      remoteStates.delete(message.id)
      const next = { ...players }
      delete next[message.id]
      useLobby.setState({ players: next })
      break
    }
    case 'profile':
      if (players[message.id]) {
        useLobby.setState({ players: { ...players, [message.id]: profileOf(message, players[message.id]) } })
      }
      break
    case 'states':
      for (const [id, x, y, z, sw, ts] of message.s) {
        if (id === selfId) continue
        const state = remoteStates.get(id)
        if (state) addSnapshot(state, [x, y, z], sw, ts, performance.now())
      }
      break
    default:
  }
}

function open() {
  useLobby.setState({ status: 'connecting' })
  const ws = new WebSocket(WS_URL)
  socket = ws
  ws.onopen = () => {
    retries = 0
    ws.send(JSON.stringify({ t: 'hello', ...profile }))
  }
  ws.onmessage = (event) => {
    try {
      handle(JSON.parse(event.data))
    } catch (err) {
      console.warn('[lobby] bad message from server', err)
    }
  }
  ws.onclose = () => {
    if (socket !== ws) return
    socket = null
    remoteStates.clear()
    useLobby.setState({ status: 'offline', lobby: null, selfId: null, players: {} })
    if (!stopped) retryTimer = setTimeout(open, RETRY_MS[Math.min(retries++, RETRY_MS.length - 1)])
  }
}

/** Connects (and keeps reconnecting) using the latest profile. */
export function connectLobby() {
  if (!stopped) return
  stopped = false
  open()
}

export function disconnectLobby() {
  stopped = true
  clearTimeout(retryTimer)
  const ws = socket
  socket = null
  ws?.close()
  remoteStates.clear()
  useLobby.setState({ status: 'offline', lobby: null, selfId: null, players: {} })
}

/** Our name / avatar / sword. Remembered for (re)connects and sent now if online. */
export function updateProfile(next) {
  profile = next
  send({ t: 'profile', ...next })
}

/**
 * Our position (the body's centre), how many swings we've made, and the time (ms,
 * our clock) that position is for.
 */
export function sendState(p, sw, ts = performance.now()) {
  send({ t: 'state', p, sw, ts: Math.round(ts) })
}
