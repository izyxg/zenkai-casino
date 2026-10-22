import {prisma} from "./prisma";
import type {AnyGameState} from "./game-types";
import {blackjackAction,repairBlackjackTurn} from "./games/blackjack";
import {pokerAction,repairPokerTurn} from "./games/poker";
import {changeBalance,logEvent} from "./games/shared";
import {needsTurnRepair,turnKey,validPokerSeat} from "./turn-progress";

export async function repairGameTurn(game:any){
  const state=structuredClone(game.state) as AnyGameState;
  if(game.status!=="ACTIVE"||!needsTurnRepair(state)) return false;
  if(state.kind==="POKER"&&!state.seats.some(s=>!s.folded&&validPokerSeat(state,s.playerId))){
    await refundAndCancel(game,"La table (aucune main valide)");
    return true;
  }
  if(state.kind==="BLACKJACK") await repairBlackjackTurn(game,state);
  if(state.kind==="POKER") await repairPokerTurn(game,state);
  await logEvent(game.roomId,"TURN_REPAIR","Ordre des tours réparé : les spectateurs et mains inactives ne bloquent plus la manche.",game.id);
  return true;
}

// Called inside the room transaction, so refunds cannot race a player's action.
export async function recoverGame(roomId:string,host:any,payload:any){
  if(!host.isHost) throw new Error("Action réservée à l'hôte");
  const game=await prisma.game.findFirst({where:{roomId,status:"ACTIVE"},orderBy:{startedAt:"desc"}});
  if(!game||game.id!==payload.gameId) throw new Error("La manche a changé. Actualise la table.");
  const state=structuredClone(game.state) as AnyGameState;
  if(payload.turnKey!==turnKey(state)) throw new Error("Le tour a changé. Vérifie la table avant de confirmer.");
  if(payload.mode==="REPAIR"){
    if(!await repairGameTurn(game)) await logEvent(roomId,"TURN_REPAIR",`${host.name} vérifie les tours : aucune main inactive à passer.`,game.id);
    return;
  }
  if(payload.mode==="SKIP"){
    if(needsTurnRepair(state)){await repairGameTurn(game);return;}
    if(state.kind==="BLACKJACK"&&state.dealerPhase==="PLAYERS"){
      const id=state.order[state.turnIndex];
      await blackjackAction(game.id,id,"STAND");
      await logEvent(roomId,"HOST_SKIP",`${host.name} passe le joueur bloqué : sa main reste en l'état.`,game.id,{playerId:id});
      return;
    }
    if(state.kind==="POKER"&&state.stage!=="SHOWDOWN"){
      const id=state.seats[state.currentIndex]?.playerId;
      if(!id) throw new Error("Aucun joueur à passer");
      await pokerAction(game.id,id,"FOLD");
      await logEvent(roomId,"HOST_SKIP",`${host.name} couche la main du joueur bloqué.`,game.id,{playerId:id});
      return;
    }
    throw new Error("Aucun tour joueur à passer. Le croupier doit jouer, ou l'hôte peut annuler la manche.");
  }
  if(payload.mode!=="CANCEL") throw new Error("Outil inconnu");
  await refundAndCancel(game,host.name);
}

async function refundAndCancel(game:any,actor:string){
  const state=structuredClone(game.state) as AnyGameState,roomId=game.roomId;
  if(state.kind==="BLACKJACK"&&state.settled||state.kind==="POKER"&&state.stage==="SHOWDOWN"||state.kind==="COINFLIP"&&state.result)
    throw new Error("La manche est déjà réglée");
  const refunds=state.kind==="BLACKJACK"?Object.entries(state.hands).map(([id,h])=>[id,h.bet] as const):
    state.kind==="POKER"?state.seats.map(s=>[s.playerId,s.totalBet] as const):[];
  for(const [id,amount] of refunds){
    if(!Number.isSafeInteger(amount)||amount<0) throw new Error("Mise invalide. Annulation interrompue.");
    if(amount>0) await changeBalance(roomId,id,amount,"REFUND","Annulation de manche par l'hôte");
  }
  await prisma.game.update({where:{id:game.id},data:{status:"FINISHED",endedAt:new Date(),state:{...state,cancelled:true} as any}});
  await prisma.player.updateMany({where:{roomId},data:{currentBet:0}});
  await prisma.room.update({where:{id:roomId},data:{status:"LOBBY"}});
  await logEvent(roomId,"GAME_CANCELLED",`${actor} annule la manche. Toutes les mises engagées sont remboursées.`,game.id);
}
