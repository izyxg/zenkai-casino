import crypto from "crypto";
import { prisma } from "../prisma";
import type { CoinState } from "../game-types";
import { changeBalance, logEvent } from "./shared";

export function newCoinState():CoinState { return {kind:"COINFLIP",commits:{}}; }

export async function coinCommit(gameId:string, playerId:string, bet:number, choice:"PILE"|"FACE"){
  const game=await prisma.game.findUniqueOrThrow({where:{id:gameId},include:{room:{include:{players:true}}}});
  const state=game.state as unknown as CoinState;
  if(state.kind!=="COINFLIP" || state.result) throw new Error("Manche terminée");
  const p=game.room.players.find(x=>x.id===playerId); if(!p) throw new Error("Joueur introuvable");
  if(bet<game.room.minBet||bet>game.room.maxBet||bet>p.balance) throw new Error("Mise invalide");
  const entries=Object.entries(state.commits);
  if(entries.length && entries[0][1].bet!==bet) throw new Error(`La mise doit être ${entries[0][1].bet} Ryôs`);
  if(entries.length && entries[0][1].choice===choice) throw new Error(`Votre adversaire a choisi ${choice}. Choisissez l’autre face.`);
  if(state.commits[playerId]) throw new Error("Choix déjà verrouillé");
  state.commits[playerId]={bet,choice};
  await logEvent(game.roomId,"COIN_COMMIT",`${p.name} verrouille une mise de ${bet} Ryôs.`,game.id);
  if(Object.keys(state.commits).length<2){await prisma.game.update({where:{id:game.id},data:{state:state as any}});return;}
  const ids=Object.keys(state.commits); const result=crypto.randomInt(2)===0?"PILE":"FACE"; state.result=result;
  const winner=ids.find(id=>state.commits[id].choice===result) ?? ids[0]; state.winnerId=winner;
  for(const id of ids) await changeBalance(game.roomId,id,-bet,"BET","Mise Pile ou Face");
  await changeBalance(game.roomId,winner,bet*2,"WIN",`Victoire Pile ou Face (${result})`);
  const wp=game.room.players.find(x=>x.id===winner)!;
  await logEvent(game.roomId,"COIN_RESULT",`${result} ! ${wp.name} remporte ${bet*2} Ryôs.`,game.id,{result,winnerId:winner});
  await prisma.game.update({where:{id:game.id},data:{state:state as any,status:"FINISHED",endedAt:new Date()}});
  await prisma.room.update({where:{id:game.roomId},data:{status:"LOBBY"}});
}
