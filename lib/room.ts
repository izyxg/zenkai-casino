import { prisma } from "./prisma";
import { hashToken } from "./auth";
import { publicGameState } from "./game-engine";

export async function authenticatePlayer(roomCode:string, playerId:string, token:string){
  const room=await prisma.room.findUnique({where:{code:roomCode.toUpperCase()},include:{players:true}});
  if(!room) throw new Error("Room introuvable");
  const player=room.players.find(p=>p.id===playerId);
  if(!player||player.sessionHash!==hashToken(token)) throw new Error("Session invalide");
  await prisma.player.update({where:{id:player.id},data:{lastSeen:new Date()}});
  return {room,player};
}

export async function roomSnapshot(code:string, viewerId:string){
  const room=await prisma.room.findUnique({
    where:{code:code.toUpperCase()},
    include:{
      players:{orderBy:{joinedAt:"asc"}},
      games:{orderBy:{startedAt:"desc"},take:1},
      events:{orderBy:{createdAt:"desc"},take:60}
    }
  });
  if(!room) return null;
  const game=room.games[0] ?? null;
  return {
    id:room.id,
    code:room.code,
    gameType:room.gameType,
    status:room.status,
    minBet:room.minBet,
    maxBet:room.maxBet,
    maxPlayers:room.maxPlayers,
    startingBalance:room.startingBalance,
    blackjackDealerMode:room.blackjackDealerMode,
    locked:room.locked,
    players:room.players.map(p=>({
      id:p.id,
      name:p.name,
      balance:p.balance,
      currentBet:p.currentBet,
      isHost:p.isHost,
      lastSeen:p.lastSeen
    })),
    game:game?{
      id:game.id,
      type:game.type,
      status:game.status,
      state:publicGameState(game.state as any,viewerId)
    }:null,
    events:room.events.reverse().map(e=>({
      id:e.id,
      type:e.type,
      message:e.message,
      createdAt:e.createdAt
    }))
  };
}
