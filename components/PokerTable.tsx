"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight, CircleDollarSign, Flag, Layers3, Minus, Plus, X } from "lucide-react";
import { CardView } from "./CardView";
import { CardTable, TablePlayer } from "./CardTable";
import PokerGuide from "./PokerGuide";
import {turnKey} from "@/lib/turn-progress";
import { pokerControls, pokerPositions, pokerPots } from "@/lib/poker-view";
import type { PokerState } from "@/lib/game-types";

const fmt=(n:number)=>n.toLocaleString("fr-FR");
const stages=["PREFLOP","FLOP","TURN","RIVER"] as const;
const labels:Record<string,string>={PREFLOP:"Préflop",FLOP:"Flop",TURN:"Turn",RIVER:"River",SHOWDOWN:"Abattage"};
type Player={id:string;name:string;balance:number};
type Props={state:PokerState;players:Player[];me:Player;gameId:string;finished:boolean;
  busy:boolean;onAction:(action:string,payload?:any)=>Promise<void>;onNext?:()=>void;result?:string};

export default function PokerTable({state:s,players,me,gameId,finished,busy,onAction,onNext,result}:Props) {
  const controls=pokerControls(s,me.id,me.balance);
  const {seat:mine,call,callPayment,minRaise,maxRaise,canRaise,canAllIn}=controls;
  const current=s.seats[s.currentIndex];
  const turn=!finished&&s.stage!=="SHOWDOWN"&&current?.playerId===me.id&&!mine?.allIn&&!mine?.folded;
  const activeName=players.find(p=>p.id===current?.playerId)?.name??"Joueur";
  const [amount,setAmount]=useState(String(minRaise));
  const [confirmAllIn,setConfirmAllIn]=useState(false);
  const actionKey=gameId+":"+s.stage+":"+s.currentBet+":"+(mine?.roundBet??0)+":"+turn;
  useEffect(()=>{setAmount(String(minRaise));setConfirmAllIn(false);},[actionKey,minRaise]);
  const raise=Number(amount);
  const validRaise=/^\d+$/.test(amount)&&Number.isSafeInteger(raise)&&raise>=minRaise&&raise<=maxRaise;
  const ownCards=s.hole[me.id]??[];
  const play=(payload:any)=>onAction("POKER",{...payload,gameId,turnKey:turnKey(s)});
  const playerMap=new Map(players.map(p=>[p.id,p]));
  const pots=pokerPots(s);
  const myIndex=Math.max(0,s.seats.findIndex(seat=>seat.playerId===me.id));
  const seats=[...s.seats.slice(myIndex),...s.seats.slice(0,myIndex)];
  const tableSeats=seats.map(seat=>{
      const i=s.seats.indexOf(seat),p=playerMap.get(seat.playerId);
      const active=!finished&&s.stage!=="SHOWDOWN"&&s.currentIndex===i;
      return <TablePlayer key={seat.playerId} className="pokerSeat" name={p?.name??"Joueur"} balance={p?.balance}
        isMe={seat.playerId===me.id} active={active} folded={seat.folded} bet={seat.roundBet}
        cards={s.hole[seat.playerId]??["??","??"]} status={seat.folded?"Couché":seat.allIn?"Tapis":"En jeu"}
        badges={pokerPositions(s,i).map(b=><abbr key={b} title={b==="D"?"Bouton":b==="SB"?"Petite blind":"Grosse blind"}>{b}</abbr>)}/>;
    });

  return <section className="pokerExperience" aria-label="Table de Texas Hold'em">
    <header className="pokerHeading">
      <div><span className="eyebrow">LE CERCLE DU RYÔ</span><h1>Texas Hold’em</h1></div>
      <div className={`pokerTurn ${turn?"yours":""}`} role="status"><i/>
        {finished?"Main terminée":turn?"À vous de jouer":activeName+" joue"}</div>
    </header>
    <PokerGuide/>
    <CardTable className="pokerArena" label="Tapis de poker" seats={tableSeats}>
      <div className="pokerBoard">
        <ol className="pokerStreets" aria-label="Avancement de la main">{stages.map((stage,i)=>
          <li key={stage} className={s.stage===stage?"current":s.board.length>=[0,3,4,5][i]?"dealt":""}>
            {labels[stage]}{i<3&&<ChevronRight size={12} aria-hidden="true"/>}</li>)}</ol>
        <div className="pokerPot"><span>Pot total</span><strong>{fmt(s.pot)} <small>Ryôs</small></strong></div>
        <div className="pokerCommunity" aria-label="Cartes communes">
          {[0,1,2,3,4].map(i=>s.board[i]?<CardView key={s.board[i]} card={s.board[i]} source="board" delay={i*80}/>:
            <div className="pokerEmptyCard" key={i} aria-label="Carte non distribuée"><span>{i<3?"F":i===3?"T":"R"}</span></div>)}
        </div>
        <div className="pokerBoardMeta"><span><Layers3 size={14}/>{s.seats.filter(p=>!p.folded).length} en jeu</span>
          <span>Mise à suivre <b>{fmt(s.currentBet)}</b></span>
          {pots.length>1&&<span title={pots.map((pot,i)=>(i===0?"Principal":"Annexe "+i)+": "+fmt(pot)).join(" / ")}>{pots.length} pots</span>}
        </div>
      </div>
    </CardTable>
    {pots.length>1&&<div className="pokerPotBreakdown" aria-label="Répartition des pots">{pots.map((pot,i)=><span key={i}>{i===0?"Pot principal":"Pot annexe "+i}<b>{fmt(pot)} Ryôs</b></span>)}</div>}
    {!!s.winners?.length&&<div className="pokerWinners" role="status"><Flag size={20}/>
      <div>{s.winners.map(w=><p key={w.playerId}><b>{playerMap.get(w.playerId)?.name??"Joueur"}</b>
        <span>{w.label}</span><strong>+{fmt(w.amount)} Ryôs</strong></p>)}</div></div>}
    <div className={`pokerConsole ${turn?"yourTurn":""}`}>
      <div className="pokerOwnHand"><div className="pokerOwnCards">{ownCards.map((card,i)=><CardView key={i+card} card={card} mini/>)}</div>
        <div><span>{mine?"Votre main":"Spectateur"}</span><b>{mine?.folded?"Vous êtes couché":s.handLabel??(mine?.allIn?"Vous êtes à tapis":labels[s.stage])}</b>
          <small>Solde : {fmt(me.balance)} Ryôs</small></div></div>
      {turn?<div className="pokerDecision">
        <div className="pokerMainActions">
          <button className="pokerFold" disabled={busy} onClick={()=>play({move:"FOLD"})}><X size={16}/>Se coucher</button>
          <button className="pokerCall" disabled={busy} onClick={()=>play({move:call>0?"CALL":"CHECK"})}>
            <Check size={18}/>{call>0?"Suivre "+fmt(callPayment)+(callPayment<call?" · tapis":""):"Parole"}</button>
          <button className="pokerAllIn" disabled={busy||!canAllIn} onClick={()=>setConfirmAllIn(v=>!v)}><CircleDollarSign size={18}/>Tapis</button>
        </div>
        {confirmAllIn?<div className="pokerAllInConfirm" role="group" aria-label="Confirmer le tapis">
          <span>Engager vos {fmt(me.balance)} Ryôs restants ?</span>
          <button disabled={busy||!turn} onClick={()=>{setConfirmAllIn(false);void play({move:"ALLIN"});}}>Confirmer</button>
          <button title="Annuler le tapis" aria-label="Annuler le tapis" onClick={()=>setConfirmAllIn(false)}><X size={16}/></button>
        </div>:<div className="pokerRaise">
          <div className="raiseSizing">{controls.presets.map(p=><button key={p.label} disabled={busy||!canRaise}
            onClick={()=>setAmount(String(p.amount))}>{p.label}</button>)}</div>
          <label className="raiseNumber"><span>Relancer à</span><div>
            <button aria-label="Diminuer la relance" title="Diminuer" disabled={busy||!canRaise} onClick={()=>setAmount(String(Math.max(minRaise,(validRaise?raise:minRaise)-s.minRaise)))}><Minus size={14}/></button>
            <input aria-label="Total de relance" type="number" min={minRaise} max={maxRaise} step={1}
              value={amount} disabled={busy||!canRaise} onChange={e=>setAmount(e.target.value)}/>
            <button aria-label="Augmenter la relance" title="Augmenter" disabled={busy||!canRaise} onClick={()=>setAmount(String(Math.min(maxRaise,(validRaise?raise:minRaise)+s.minRaise)))}><Plus size={14}/></button>
          </div></label>
          <input aria-label="Montant de relance" type="range" min={Math.min(minRaise,maxRaise)} max={maxRaise}
            value={validRaise?raise:Math.min(minRaise,maxRaise)} step={1} disabled={busy||!canRaise} onChange={e=>setAmount(e.target.value)}/>
          <button className="pokerRaiseSubmit" disabled={busy||!canRaise||!validRaise} onClick={()=>play({move:"RAISE",amount:raise})}>
            Relancer<ChevronRight size={16}/></button>
        </div>}
      </div>:<div className="pokerWaiting" role="status">{finished?"Main terminée":mine?.folded?"En attente de la prochaine main":mine?.allIn?"Tapis engagé · la main continue":mine?"Au tour de "+activeName:"Vous pourrez jouer à la prochaine main"}</div>}
    </div>
    {finished&&onNext&&<div className="pokerNext"><p>{result??"La main est terminée."}</p>
      <button className="casinoBtn primary" onClick={onNext}>Revenir à la table<ChevronRight size={16}/></button></div>}
  </section>;
}
