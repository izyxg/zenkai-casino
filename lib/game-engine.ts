import { prisma } from "./prisma";
import { blackjackValue, type Card } from "./cards";
import type { AnyGameState, BlackjackState, CoinState, PokerState } from "./game-types";
import { newCoinState, coinCommit } from "./games/coinflip";
import { newBlackjackState, blackjackAction, settleBlackjack } from "./games/blackjack";
import { newPokerState, pokerAction } from "./games/poker";
export { logEvent } from "./games/shared";
export { coinCommit, blackjackAction, pokerAction };

export function publicGameState(state:AnyGameState,viewerId:string){
  if(state.kind==="BLACKJACK"){const s=structuredClone(state) as BlackjackState;if(!s.settled&&s.dealer.length>1)s.dealer=[s.dealer[0],"??" as Card];return s;}
  if(state.kind==="POKER"){const s=structuredClone(state) as PokerState;for(const id of Object.keys(s.hole))if(id!==viewerId&&s.stage!=="SHOWDOWN")s.hole[id]=["??" as Card,"??" as Card];return s;}
  return structuredClone(state) as CoinState;
}

export async function setBet(playerId:string,bet:number){
  const p=await prisma.player.findUniqueOrThrow({where:{id:playerId},include:{room:true}});
  if(bet<p.room.minBet||bet>p.room.maxBet)throw new Error(`Mise entre ${p.room.minBet} et ${p.room.maxBet} Ryôs`);
  if(bet>p.balance)throw new Error("Solde insuffisant");
  await prisma.player.update({where:{id:playerId},data:{currentBet:bet}});
}

export async function startGame(roomId:string,hostId:string){
  const room=await prisma.room.findUniqueOrThrow({where:{id:roomId},include:{players:true}});
  if(room.status==="CLOSED")throw new Error("Room fermée");
  const host=room.players.find(p=>p.id===hostId);if(!host?.isHost)throw new Error("Action réservée à l'hôte");
  if(await prisma.game.findFirst({where:{roomId,status:"ACTIVE"}}))throw new Error("Une partie est déjà en cours");
  if(room.gameType==="COINFLIP"&&room.players.length!==2)throw new Error("Pile ou Face nécessite exactement 2 joueurs");
  const state:AnyGameState=room.gameType==="COINFLIP"?newCoinState():room.gameType==="BLACKJACK"?await newBlackjackState(room):await newPokerState(room);
  const game=await prisma.game.create({data:{roomId,type:room.gameType,status:"ACTIVE",state:state as any}});
  await prisma.room.update({where:{id:roomId},data:{status:"ACTIVE"}});
  const {logEvent}=await import("./games/shared");
  await logEvent(roomId,"GAME_START",`Une partie de ${room.gameType} commence.`,game.id);
  if(state.kind==="BLACKJACK"&&(blackjackValue(state.dealer)===21||state.turnIndex>=state.order.length))await settleBlackjack(game,state);
  return game;
}
