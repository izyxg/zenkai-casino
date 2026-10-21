"use client";
import Image from "next/image";
import {useEffect,useState} from "react";
import {Check, ChevronRight, Hand, Plus, RotateCcw} from "lucide-react";
import {CardView} from "./CardView";
import {PlayerSeat} from "./PlayerSeat";
import {DealerCardPicker} from "./DealerCardPicker";
import {handTotal,blackjackLabels,blackjackOutcome} from "@/lib/blackjack-view";

const fmt=(n:number)=>Number(n||0).toLocaleString("fr-FR");
export default function BlackjackTable({snap,me,busy,error,act,onNext}:{
  snap:any;me:any;busy:boolean;error:string;act:(action:string,payload?:any)=>Promise<void>;onNext:()=>void;
}) {
  const game=snap.game,s=game.state,finished=game.status==="FINISHED";
  const [choice,setChoice]=useState<"REVEAL"|"DRAW"|null>(null);
  useEffect(()=>setChoice(null),[game.id,s.dealer.length,s.dealerRevealed,s.dealerPhase,finished]);
  const dealer=snap.players.find((p:any)=>p.id===s.dealerPlayerId);
  const isDealer=s.dealerMode==="HOST"&&s.dealerPlayerId===me.id;
  const currentId=s.order[s.turnIndex];
  const current=snap.players.find((p:any)=>p.id===currentId);
  const mine=s.hands[me.id];
  const turn=!finished&&s.dealerPhase==="PLAYERS"&&currentId===me.id&&mine?.status==="PLAYING";
  const dealerTurn=!finished&&s.dealerPhase==="DEALER";
  const dealerScore=handTotal(s.dealer),myScore=mine?handTotal(mine.cards):null;
  const visibleScore=handTotal(s.dealer.filter((c:string)=>c!=="??"));
  const canDouble=turn&&mine?.cards.length===2&&me.balance>=mine.bet;
  const players=snap.players.filter((p:any)=>!(s.dealerMode==="HOST"&&p.id===s.dealerPlayerId))
    .sort((a:any,b:any)=>Number(b.id===me.id)-Number(a.id===me.id));
  const play=(move:"REVEAL"|"DRAW")=>{
    if(s.dealerAvailableCards) setChoice(move);
    else void act("BLACKJACK_DEALER",{move});
  };
  return <section className="bjExperience">
    <header className="pokerHeading"><div><span className="eyebrow">LE CERCLE DU RYÔ</span><h1>Blackjack</h1></div>
      <div className={`pokerTurn ${turn?"yours":""}`} role="status"><i/>{finished?"Manche terminée":dealerTurn?"Tour du croupier":turn?"À vous de jouer":"Tour de "+(current?.name??"la table")}</div>
    </header>
    <div className="bjHouse bjActiveHouse">
      <Image src="/dealer-duo.webp" alt="Les croupiers du Cercle du Ryô" width={256} height={256} priority unoptimized className="bjDealerArt"/>
      <div className="bjDealerHand"><div className="bjDealerIdentity"><div><span className="eyebrow">{s.dealerMode==="HOST"?"CROUPIER HÔTE":"LA MAISON"}</span>
        <h2>{dealer?.name??"La banque"}</h2></div><strong className={dealerScore!==null&&dealerScore>21?"bust":""}>{dealerScore===null?visibleScore+" + ?":dealerScore}<small>points</small></strong></div>
        <div className="bjBankCards" aria-label="Main du croupier">{s.dealer.map((c:string,i:number)=><CardView key={c+i} card={c} source="dealer" variant="premium"/>)}</div>
        <div className="bjRuleTags"><span>Blackjack 3:2</span><span>La banque reste à 17</span></div>
      </div>
    </div>
    {mine&&<div className={`bjPlayerConsole ${turn?"yourTurn":""}`}>
      <div className="bjMyMetrics"><div><span>Votre main</span><b className={myScore!==null&&myScore>21?"bust":""}>{myScore}</b></div>
        <div><span>Mise</span><b>{fmt(mine.bet)}<small>Ryôs</small></b></div>
        <div><span>Solde</span><b>{fmt(me.balance)}<small>Ryôs</small></b></div></div>
      {turn?<div className="bjPlayerActions">
        <button disabled={busy} className="hit" onClick={()=>act("BLACKJACK",{move:"HIT"})}><Plus size={20}/>Tirer</button>
        <button disabled={busy} className="stand" onClick={()=>act("BLACKJACK",{move:"STAND"})}><Hand size={20}/>Rester</button>
        <button disabled={busy||!canDouble} title={canDouble?"Mise totale : "+fmt(mine.bet*2):"Deux cartes et un solde suffisant sont nécessaires"} onClick={()=>act("BLACKJACK",{move:"DOUBLE"})}>
          <span aria-hidden="true">×2</span>Doubler</button>
      </div>:<p className="bjWaiting" role="status">{finished?blackjackOutcome(mine):dealerTurn?"La banque joue sa main":mine.status==="BUST"?"Votre main dépasse 21":current?.name+" joue"}</p>}
    </div>}
    {isDealer&&dealerTurn&&<div className="bjDealerConsole">
      <div><span className="eyebrow">VOTRE TOUR</span><b>{!s.dealerRevealed?"La carte cachée":(dealerScore??0)<17?"La banque doit tirer":"Prêt pour le règlement"}</b></div>
      {!s.dealerRevealed?<button className="bjDealButton" disabled={busy} onClick={()=>play("REVEAL")}><RotateCcw size={18}/>Révéler</button>:
        <><button disabled={busy||(dealerScore??0)>=17} onClick={()=>play("DRAW")}><Plus size={18}/>Tirer</button>
          <button className="bjDealButton" disabled={busy||(dealerScore??0)<17} onClick={()=>act("BLACKJACK_DEALER",{move:"SETTLE"})}><Check size={18}/>Régler la table</button></>}
    </div>}
    <div className="bjHandsGrid">{players.map((p:any)=>{
      const hand=s.hands[p.id];
      return <PlayerSeat key={p.id} player={p} isMe={p.id===me.id}
        active={!finished&&s.dealerPhase==="PLAYERS"&&currentId===p.id} table="blackjack"
        cards={hand?.cards??[]} bet={hand?.bet??0} score={hand?handTotal(hand.cards):undefined}
        status={hand?blackjackLabels[hand.status]??hand.status:"Spectateur"}/>;
    })}</div>
    {!mine&&!isDealer&&!finished&&<p className="bjWaiting">Vous êtes spectateur pour cette manche.</p>}
    {isDealer&&dealerTurn&&choice&&s.dealerAvailableCards&&<DealerCardPicker
      key={game.id+choice+s.dealer.length} move={choice} cards={s.dealerAvailableCards} busy={busy} error={error}
      onChoose={card=>act("BLACKJACK_DEALER",{move:choice,card})} onClose={()=>setChoice(null)}/>}
    {finished&&<div className="pokerNext"><p>{mine?blackjackOutcome(mine):"Les gains ont été réglés."}</p>
      <button className="bjDealButton" onClick={onNext}>Prochaine manche<ChevronRight size={18}/></button></div>}
  </section>;
}
