import { prisma } from "../prisma";
import { freshDeck, shuffle, isCard, type Card } from "../cards";
import type { PokerState } from "../game-types";
import { changeBalance, logEvent } from "./shared";
import { MAX_TABLE_PLAYERS } from "../table-limits";
import {canReopenRaise,hasRaiseOpponent,nextPokerDealer,pokerCallAmount} from "../poker-rules";
import {pokerAwards} from "../poker-settlement";
import {validPokerSeat} from "../turn-progress";

export async function newPokerState(room:any):Promise<PokerState>{
  const eligible=room.players.filter((p:any)=>!p.isSpectator&&p.balance>0);
  if(eligible.length>MAX_TABLE_PLAYERS) throw new Error("La table de poker est limitée à 13 joueurs");
  if(eligible.length<2) throw new Error("Le poker nécessite au moins 2 joueurs avec assez de Ryôs");
  if(eligible.some((p:any)=>!Number.isSafeInteger(p.balance))||eligible.reduce((n:number,p:any)=>n+p.balance,0)>2_000_000_000)
    throw new Error("Le capital des joueurs dépasse la limite de 2 milliards de Ryôs par table");
  const deck=shuffle(freshDeck()), hole:Record<string,Card[]>={}; eligible.forEach((p:any)=>hole[p.id]=[deck.pop()!,deck.pop()!]);
  const sb=Math.max(room.minBet,1),bb=sb*2;
  const seats=eligible.map((p:any)=>({playerId:p.id,folded:false,allIn:false,roundBet:0,totalBet:0}));
  const dealerIndex=nextPokerDealer(eligible.map((p:any)=>p.id),room.previousDealerId,room.previousPlayerOrder);
  const sbIdx=eligible.length===2?dealerIndex:(dealerIndex+1)%eligible.length;
  const bbIdx=(sbIdx+1)%eligible.length;
  const blind=async(i:number,a:number)=>{const p=eligible[i],real=Math.min(a,p.balance);await changeBalance(room.id,p.id,-real,"BET","Blind Poker");seats[i].roundBet=real;seats[i].totalBet=real;if(real===p.balance)seats[i].allIn=true;return real;};
  const sbPaid=await blind(sbIdx,sb),bbPaid=await blind(bbIdx,bb);
  const state:PokerState={kind:"POKER",deck,board:[],hole,seats,dealerIndex,currentIndex:bbIdx,stage:"PREFLOP",currentBet:bb,bigBlind:bb,minRaise:bb,pot:sbPaid+bbPaid,acted:[],lastActionBet:{}};
  state.currentIndex=next(state,bbIdx);
  return state;
}

const active=(s:PokerState)=>s.seats.filter(x=>!x.folded);
const next=(s:PokerState,from:number)=>{for(let k=1;k<=s.seats.length;k++){const i=(from+k)%s.seats.length;if(!s.seats[i].folded&&!s.seats[i].allIn)return i;}return from;};
const roundDone=(s:PokerState)=>active(s).filter(x=>!x.allIn).every(x=>pokerCallAmount(s,x.playerId)===0&&s.acted.includes(x.playerId));

function checkWagers(s:PokerState){
  if(!Number.isSafeInteger(s.pot)||s.pot<0||s.seats.some(p=>!Number.isSafeInteger(p.totalBet)||p.totalBet<0||
    !Number.isSafeInteger(p.roundBet)||p.roundBet<0||p.roundBet>p.totalBet)||s.seats.reduce((n,p)=>n+p.totalBet,0)!==s.pot)
    throw new Error("Comptabilité du pot invalide : annulez la manche pour rembourser les mises");
}

async function refundUncalled(game:any,s:PokerState){
  const ordered=[...s.seats].sort((a,b)=>b.totalBet-a.totalBet);
  const highest=ordered[0],amount=highest.totalBet-(ordered[1]?.totalBet??0);
  if(amount<=0) return;
  await changeBalance(game.roomId,highest.playerId,amount,"REFUND","Part de mise non suivie au Poker");
  highest.totalBet-=amount;highest.roundBet=Math.max(0,highest.roundBet-amount);s.pot-=amount;
  await logEvent(game.roomId,"POKER_REFUND",`${amount} Ryôs non suivis sont rendus au joueur.`,game.id,{playerId:highest.playerId,amount});
}

function draw(s:PokerState){
  const card=s.deck.pop();
  if(!isCard(card)) throw new Error("Pioche de poker invalide ou vide : annulez la manche pour rembourser");
  return card;
}

async function finish(game:any,s:PokerState){
  s.stage="SHOWDOWN";
  await prisma.game.update({where:{id:game.id},data:{state:s as any,status:"FINISHED",endedAt:new Date()}});
  await prisma.room.update({where:{id:game.roomId},data:{status:"LOBBY"}});
  await logEvent(game.roomId,"POKER_RESULT",`Main terminée. Pot partagé : ${s.pot} Ryôs.`,game.id,s.winners);
}

async function showdown(game:any,s:PokerState){
  const awards=pokerAwards(s);
  for(const award of awards) await changeBalance(game.roomId,award.playerId,award.amount,"WIN",`Victoire Poker - ${award.label}`);
  s.winners=awards;
  await finish(game,s);
}

async function advance(game:any,s:PokerState){
  checkWagers(s);
  if(active(s).length===1){
    await refundUncalled(game,s);
    const w=active(s)[0];
    await changeBalance(game.roomId,w.playerId,s.pot,"WIN","Victoire Poker - dernier joueur en jeu");
    s.winners=[{playerId:w.playerId,amount:s.pot,label:"Dernier joueur en jeu"}];
    return finish(game,s);
  }
  const able=active(s).filter(x=>!x.allIn);
  const noMoreBets=able.length<=1&&(!able[0]||pokerCallAmount(s,able[0].playerId)===0);
  if(!roundDone(s)&&!noMoreBets){s.currentIndex=next(s,s.currentIndex);await prisma.game.update({where:{id:game.id},data:{state:s as any}});return;}
  await refundUncalled(game,s);
  s.seats.forEach(x=>x.roundBet=0);s.currentBet=0;s.acted=[];s.lastActionBet={};s.minRaise=s.bigBlind??s.minRaise;
  if(s.stage==="PREFLOP"){s.board.push(draw(s),draw(s),draw(s));s.stage="FLOP";}else if(s.stage==="FLOP"){s.board.push(draw(s));s.stage="TURN";}else if(s.stage==="TURN"){s.board.push(draw(s));s.stage="RIVER";}else return showdown(game,s);
  s.currentIndex=next(s,s.dealerIndex);if(active(s).filter(x=>!x.allIn).length<=1)return advance(game,s);await prisma.game.update({where:{id:game.id},data:{state:s as any}});
}

export async function beginPokerHand(game:any,s:PokerState){
  const able=active(s).filter(x=>!x.allIn);
  if(able.length<=1&&(!able[0]||pokerCallAmount(s,able[0].playerId)===0)) await advance(game,s);
}

export async function repairPokerTurn(game:any,s:PokerState){
  for(const seat of s.seats) if(!validPokerSeat(s,seat.playerId)) seat.folded=true;
  if(active(s).length===0) throw new Error("Aucune main valide. Annulez la manche pour rembourser les mises.");
  const seat=s.seats[s.currentIndex];
  if(!Number.isInteger(s.currentIndex)||s.currentIndex<0||s.currentIndex>=s.seats.length) s.currentIndex=s.seats.length-1;
  if(!seat||seat.folded||seat.allIn||active(s).length===1) return advance(game,s);
  await prisma.game.update({where:{id:game.id},data:{state:s as any}});
}

export async function pokerAction(gameId:string,playerId:string,action:"FOLD"|"CHECK"|"CALL"|"RAISE"|"ALLIN",amount?:number){
  const game=await prisma.game.findUniqueOrThrow({where:{id:gameId}});
  const s=game.state as unknown as PokerState;
  if(game.status!=="ACTIVE"||s.kind!=="POKER"||s.stage==="SHOWDOWN") throw new Error("La main est déjà terminée");
  if(!["FOLD","CHECK","CALL","RAISE","ALLIN"].includes(action)) throw new Error("Action de poker invalide");

  const seat=s.seats[s.currentIndex];
  if(!seat||seat.playerId!==playerId||seat.folded||seat.allIn||!validPokerSeat(s,playerId)) throw new Error("Attends ton tour");
  checkWagers(s);

  const player=await prisma.player.findUniqueOrThrow({where:{id:playerId}});
  const toCall=pokerCallAmount(s,playerId);
  const raiseReopened=canReopenRaise(s,playerId);
  let eventMessage="";

  const pay=async(v:number)=>{
    const real=Math.min(v,player.balance);
    if(real>0) await changeBalance(game.roomId,playerId,-real,"BET","Mise Poker");
    seat.roundBet+=real;
    seat.totalBet+=real;
    s.pot+=real;
    if(real===player.balance) seat.allIn=true;
    return real;
  };

  if(action==="FOLD"){
    seat.folded=true;
    eventMessage=`${player.name} se couche.`;
  }else if(action==="CHECK"){
    if(toCall!==0) throw new Error("Tu dois suivre la mise ou te coucher");
    eventMessage=`${player.name} fait parole.`;
  }else if(action==="CALL"){
    const paid=await pay(toCall);
    eventMessage=`${player.name} suit ${paid} Ryôs.`;
  }else if(action==="ALLIN"){
    if(player.balance<=0) throw new Error("Solde insuffisant");
    if(player.balance>toCall&&(!raiseReopened||!hasRaiseOpponent(s,playerId))) throw new Error("La relance n'est pas rouverte");
    const before=seat.roundBet;
    const paid=await pay(player.balance);
    if(seat.roundBet>s.currentBet){
      const increase=seat.roundBet-s.currentBet;
      if(increase>=s.minRaise){s.minRaise=increase;s.acted=[];}
      s.currentBet=seat.roundBet;
    }
    eventMessage=`${player.name} fait tapis à ${before+paid} Ryôs.`;
  }else if(action==="RAISE"){
    const target=amount??0;
    if(!hasRaiseOpponent(s,playerId)) throw new Error("Aucun adversaire ne peut suivre une relance");
    if(!raiseReopened) throw new Error("La relance n'est pas rouverte");
    if(!Number.isSafeInteger(target)||target<1) throw new Error("Relance entière invalide");
    const minTarget=s.currentBet+s.minRaise;
    if(target<minTarget) throw new Error(`Relance minimale : ${minTarget} Ryôs`);
    const need=target-seat.roundBet;
    if(need<=toCall) throw new Error("La relance doit dépasser la mise actuelle");
    if(need>player.balance) throw new Error("Solde insuffisant pour cette relance");
    const old=s.currentBet;
    await pay(need);
    s.currentBet=seat.roundBet;
    s.minRaise=Math.max(1,s.currentBet-old);
    s.acted=[];
    eventMessage=`${player.name} relance à ${s.currentBet} Ryôs.`;
  }

  if(eventMessage) await logEvent(game.roomId,"POKER_ACTION",eventMessage,game.id);
  if(!s.acted.includes(playerId)) s.acted.push(playerId);
  s.lastActionBet={...s.lastActionBet,[playerId]:s.currentBet};
  await advance(game,s);
}
