import { Room, Player } from '../../shared-types/types'

const rooms = new Map<string, Room>()

function generateRoomCode(length = 4) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < length; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export function createRoom(hostSocketId: string) {
  let code = generateRoomCode()
  let tries = 0
  while (rooms.has(code) && tries < 5) {
    code = generateRoomCode()
    tries++
  }

  const room: Room = {
    code,
    hostSocketId,
    players: new Map<string, Player>(),
    state: 'lobby',
    game: null
  }
  rooms.set(code, room)
  return room
}

export function getRoom(code: string) {
  return rooms.get(code) || null
}

export function joinRoom(code: string, player: Player) {
  const room = rooms.get(code)
  if (!room) return null
  room.players.set(player.id, player)
  return room
}

export function leaveRoom(code: string, playerId: string) {
  const room = rooms.get(code)
  if (!room) return null
  room.players.delete(playerId)
  return room
}

export function listRooms() {
  return Array.from(rooms.values())
}
