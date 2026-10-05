import { prisma } from "../prisma";
import { bestPokerHand, compareScore, freshDeck, shuffle, type Card } from "../cards";
import type { PokerState } from "../game-types";
import { changeBalance, logEvent } from "./shared";

export async function newPokerState(room:any):Promise<PokerState>{
  const eligible=room.players.filter((p:any)=>p.balance>=room.minBet).slice(0,8);
  if(eligible.length<2) throw new Error("Le poker nécessite au moins 2 joueurs avec assez de Ryôs");
  const deck=shuffle(freshDeck()), hole:Record<string,Card[]>={}; eligible.forEach((p:any)=>hole[p.id]=[deck.pop()!,deck.pop()!]);
  const sb=Math.max(room.minBet,1),bb=Math.min(room.maxBet,Math.max(sb*2,sb));
  const seats=eligible.map((p:any)=>({playerId:p.id,folded:false,allIn:false,roundBet:0,totalBet:0}));
  const dealerIndex=0,sbIdx=eligible.length===2?0:1,bbIdx=eligible.length===2?1:2;
  const blind=async(i:number,a:number)=>{const p=eligible[i],real=Math.min(a,p.balance);await changeBalance(room.id,p.id,-real,"BET","Blind Poker");seats[i].roundBet=real;seats[i].totalBet=real;if(real===p.balance)seats[i].allIn=true;return real;};
  const sbPaid=await blind(sbIdx,sb),bbPaid=await blind(bbIdx,bb);
  return {kind:"POKER",deck,board:[],hole,seats,dealerIndex,currentIndex:(bbIdx+1)%eligible.length,stage:"PREFLOP",currentBet:Math.max(sbPaid,bbPaid),minRaise:Math.max(1,bb),pot:sbPaid+bbPaid,acted:[]};
}

const active=(s:PokerState)=>s.seats.filter(x=>!x.folded);
const next=(s:PokerState,from:number)=>{for(let k=1;k<=s.seats.length;k++){const i=(from+k)%s.seats.length;if(!s.seats[i].folded&&!s.seats[i].allIn)return i;}return from;};
const roundDone=(s:PokerState)=>active(s).filter(x=>!x.allIn).every(x=>x.roundBet===s.currentBet&&s.acted.includes(x.playerId));

async function showdown(game:any,s:PokerState){
  s.stage="SHOWDOWN"; const contenders=active(s); const levels=[...new Set(s.seats.map(x=>x.totalBet).filter(x=>x>0))].sort((a,b)=>a-b); let prev=0; const awards=new Map<string,number>();
  for(const level of levels){const contributors=s.seats.filter(x=>x.totalBet>=level);const pot=(level-prev)*contributors.length;prev=level;const eligible=contenders.filter(x=>x.totalBet>=level);if(!eligible.length)continue;let winners=[eligible[0]],best=bestPokerHand([...s.hole[eligible[0].playerId],...s.board]);for(const seat of eligible.slice(1)){const score=bestPokerHand([...s.hole[seat.playerId],...s.board]);const c=compareScore(score,best);if(c>0){best=score;winners=[seat];}else if(c===0)winners.push(seat);}const share=Math.floor(pot/winners.length);let rem=pot-share*winners.length;for(const w of winners){awards.set(w.playerId,(awards.get(w.playerId)??0)+share+(rem>0?1:0));if(rem>0)rem--;}}
  s.winners=[];for(const [pid,amount] of awards){const label=bestPokerHand([...s.hole[pid],...s.board]).label;await changeBalance(game.roomId,pid,amount,"WIN",`Victoire Poker - ${label}`);s.winners.push({playerId:pid,amount,label});}
  await prisma.game.update({where:{id:game.id},data:{state:s as any,status:"FINISHED",endedAt:new Date()}});await prisma.room.update({where:{id:game.roomId},data:{status:"LOBBY"}});await logEvent(game.roomId,"POKER_RESULT",`Showdown terminé. Pot : ${s.pot} Ryôs.`,game.id,s.winners);
}

async function advance(game:any,s:PokerState){
  if(active(s).length===1){const w=active(s)[0];await changeBalance(game.roomId,w.playerId,s.pot,"WIN","Victoire Poker - dernier joueur en jeu");s.winners=[{playerId:w.playerId,amount:s.pot,label:"Dernier joueur en jeu"}];s.stage="SHOWDOWN";await prisma.game.update({where:{id:game.id},data:{state:s as any,status:"FINISHED",endedAt:new Date()}});await prisma.room.update({where:{id:game.roomId},data:{status:"LOBBY"}});return;}
  if(!roundDone(s)){s.currentIndex=next(s,s.currentIndex);await prisma.game.update({where:{id:game.id},data:{state:s as any}});return;}
  s.seats.forEach(x=>x.roundBet=0);s.currentBet=0;s.acted=[];
  if(s.stage==="PREFLOP"){s.board.push(s.deck.pop()!,s.deck.pop()!,s.deck.pop()!);s.stage="FLOP";}else if(s.stage==="FLOP"){s.board.push(s.deck.pop()!);s.stage="TURN";}else if(s.stage==="TURN"){s.board.push(s.deck.pop()!);s.stage="RIVER";}else return showdown(game,s);
  s.currentIndex=next(s,s.dealerIndex);if(active(s).filter(x=>!x.allIn).length<=1)return advance(game,s);await prisma.game.update({where:{id:game.id},data:{state:s as any}});
}

export async function pokerAction(gameId:string,playerId:string,action:"FOLD"|"CHECK"|"CALL"|"RAISE"|"ALLIN",amount?:number){
  const game=await prisma.game.findUniqueOrThrow({where:{id:gameId}});const s=game.state as unknown as PokerState;if(s.kind!=="POKER"||s.stage==="SHOWDOWN")throw new Error("Partie terminée");const seat=s.seats[s.currentIndex];if(seat.playerId!==playerId)throw new Error("Ce n'est pas votre tour");const player=await prisma.player.findUniqueOrThrow({where:{id:playerId}});const toCall=Math.max(0,s.currentBet-seat.roundBet);
  const pay=async(v:number)=>{const real=Math.min(v,player.balance);if(real>0)await changeBalance(game.roomId,playerId,-real,"BET","Mise Poker");seat.roundBet+=real;seat.totalBet+=real;s.pot+=real;if(real===player.balance)seat.allIn=true;return real;};
  if(action==="FOLD")seat.folded=true;else if(action==="CHECK"){if(toCall!==0)throw new Error("Impossible de check : une mise est à suivre");}else if(action==="CALL")await pay(toCall);else if(action==="ALLIN"){await pay(player.balance);if(seat.roundBet>s.currentBet){s.minRaise=Math.max(s.minRaise,seat.roundBet-s.currentBet);s.currentBet=seat.roundBet;s.acted=[];}}else if(action==="RAISE"){const target=amount??0;if(target<s.currentBet+s.minRaise)throw new Error(`Relance minimale : ${s.currentBet+s.minRaise}`);const need=target-seat.roundBet;if(need>player.balance)throw new Error("Solde insuffisant");const old=s.currentBet;await pay(need);s.currentBet=seat.roundBet;s.minRaise=Math.max(1,s.currentBet-old);s.acted=[];}
  if(!s.acted.includes(playerId))s.acted.push(playerId);await advance(game,s);
}
