import { prisma, withRoomMutation } from "./prisma";
import {needsTurnRepair} from "./turn-progress";
import {repairGameTurn} from "./game-recovery";
import { hashToken } from "./auth";
import { publicGameState } from "./game-engine";

export async function authenticatePlayer(roomCode:string, playerId:string, token:string){
  const room=await prisma.room.findUnique({where:{code:roomCode.toUpperCase()},include:{players:true}});
  if(!room) throw new Error("Salon introuvable");
  const player=room.players.find(p=>p.id===playerId);
  if(!player||player.sessionHash!==hashToken(token)) throw new Error("Accès invalide");
  // Keep presence fresh without a database write for every short poll.
  if(Date.now()-new Date(player.lastSeen).getTime()>=5000){
    await prisma.player.update({where:{id:player.id},data:{lastSeen:new Date()}});
  }
  return {room,player};
}

export async function roomSnapshot(code:string, viewerId:string,repair=true):Promise<any>{
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
  if(repair&&game?.status==="ACTIVE"&&needsTurnRepair(game.state as any)){
    await withRoomMutation(room.id,async()=>{
      const current=await prisma.game.findFirst({where:{roomId:room.id,status:"ACTIVE"},orderBy:{startedAt:"desc"}});
      if(current) await repairGameTurn(current);
    });
    return roomSnapshot(code,viewerId,false);
  }
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
    blackjackAutoStartAt:room.blackjackAutoStartAt,
    locked:room.locked,
    players:room.players.map(p=>({
      id:p.id,
      name:p.name,
      balance:p.balance,
      currentBet:p.currentBet,
      isHost:p.isHost,
      isSpectator:p.isSpectator??false,
      lastSeen:p.lastSeen
    })),
    game:game?{
      id:game.id,
      type:game.type,
      status:game.status,
      endedAt:game.endedAt,
      state:publicGameState(game.state as any,viewerId,room.dealerCardChoiceEnabled)
    }:null,
    events:room.events.reverse().map(e=>({
      id:e.id,
      gameId:e.gameId,
      type:e.type,
      message:e.message,
      createdAt:e.createdAt
    }))
  };
}
