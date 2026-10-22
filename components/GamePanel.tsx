"use client";

import {useState} from "react";
import {ChevronRight, Coins} from "lucide-react";
import {PlayerSeat} from "./PlayerSeat";
import PokerTable from "./PokerTable";
import BlackjackTable from "./BlackjackTable";
import BlackjackLobby from "./BlackjackLobby";
import {CardTable,TablePlayer} from "./CardTable";
import PokerGuide from "./PokerGuide";

const fmt=(n:number)=>Number(n||0).toLocaleString("fr-FR");
type Props={snap:any;me:any;act:(action:string,payload?:any)=>Promise<void>;error?:string;busy?:boolean};

export default function GamePanel({snap,me,act,error="",busy=false}:Props) {
  const game=snap.game;
  const [bet,setBet]=useState(snap.minBet);
  const [dismissed,setDismissed]=useState<string|null>(null);
  const showFinished=game?.status==="FINISHED"&&dismissed!==game.id;
  const next=()=>setDismissed(game.id);
  const lastEvent=snap.events?.at(-1)?.message;

  if(!game||game.state.cancelled||(game.status!=="ACTIVE"&&!showFinished)) {
    if(snap.gameType==="BLACKJACK") return <BlackjackLobby snap={snap} me={me} busy={busy} act={act}/>;
    const poker=snap.gameType==="POKER";
    const seated=snap.players.filter((p:any)=>!p.isSpectator);
    const eligible=seated.filter((p:any)=>poker?p.balance>0:p.balance>=snap.minBet);
    const canStart=poker?eligible.length>=2:snap.players.length===2;
    return <section className="tableWaiting">
      <header className="pokerHeading"><div><span className="eyebrow">LE CERCLE DU RYÔ</span>
        <h1>{poker?"Texas Hold’em":"Pile ou Face"}</h1></div><span className="pokerTurn"><i/>Table ouverte</span></header>
      {poker&&<PokerGuide/>}
      <CardTable className="tableLobby" label={poker?"Tapis de poker":"Table de duel"} seats={Array.from({length:Math.max(seated.length,Math.min(poker?6:2,snap.maxPlayers))},(_,i)=>{
        const p=seated[i];
        return <TablePlayer key={p?.id??"empty"+i} name={p?.name} balance={p?.balance} isMe={p?.id===me.id}
          status={poker&&p?.balance<=0?"Solde insuffisant":p?.isHost?"Hôte":"Prêt"}/>;
      })}>
      <div className="waitingTableArt"><Coins size={32}/><h2>{poker?"Texas Hold’em":"Pile ou Face"}</h2>
        <p>{seated.length} joueurs installés · {snap.maxPlayers} sièges</p>
        {poker&&<div className="bjRuleTags"><span>Petite blind {fmt(snap.minBet)}</span>
          <span>Grosse blind {fmt(snap.minBet*2)}</span><span>No-limit</span></div>}
      </div>
      </CardTable>
      <div className="waitingTableFooter">{me.isHost?<button className="bjDealButton" disabled={busy||!canStart}
        onClick={()=>act("START_GAME")}>{poker?"Distribuer les cartes":"Ouvrir le duel"}<ChevronRight size={18}/></button>:
        <p className="bjWaiting">En attente de l’hôte</p>}
        {!canStart&&<span>Au moins deux joueurs {poker?"avec assez de Ryôs":"présents"}</span>}</div>
    </section>;
  }
  const s=game.state;
  if(s.kind==="POKER") return <PokerTable key={game.id} state={s} players={snap.players} me={me}
    gameId={game.id} finished={game.status==="FINISHED"} busy={busy} onAction={act} result={lastEvent} onNext={next}/>;
  if(s.kind==="BLACKJACK") return <BlackjackTable key={game.id} snap={snap} me={me} act={act} busy={busy} error={error} onNext={next}/>;
  if(s.kind!=="COINFLIP") return null;

  const committed=s.commits?.[me.id];
  const players=snap.players.slice(0,2);
  const winner=snap.players.find((p:any)=>p.id===s.winnerId);
  const opponent=(Object.entries(s.commits??{}).find(([id])=>id!==me.id)?.[1]) as {choice:string;bet:number}|undefined;
  const forced=opponent?(opponent.choice==="PILE"?"FACE":"PILE"):null;
  const wager=opponent?.bet??bet;
  const valid=Number.isSafeInteger(wager)&&wager>=snap.minBet&&wager<=snap.maxBet&&wager<=me.balance;
  return <section className="gameStage coinStage">
    <div className="stageAmbient"/>
    <div className="coinDuel">
      <div className="coinPlayer left"><PlayerSeat player={players[0]} isMe={players[0]?.id===me.id} bet={s.commits?.[players[0]?.id]?.bet}/>
        {s.result&&<div className="choiceReveal">{s.commits?.[players[0]?.id]?.choice}</div>}</div>
      <div className="coinArena"><span className="roundEyebrow">PILE OU FACE</span>
        <div className={"coin3d "+(s.result?"landed":"")}><div className="coinFace">{s.result??"RYÔ"}</div></div>
        {s.result?<div className="resultCall"><b>{s.result}</b><span>{winner?.name??"Un joueur"} remporte la manche</span></div>:
          <div className="coinPrompt">{committed?"Choix verrouillé. En attente de l’adversaire.":opponent?
            "Votre adversaire prend "+opponent.choice+" · "+fmt(wager)+" Ryôs":"Choisissez votre côté"}</div>}
      </div>
      <div className="coinPlayer right"><PlayerSeat player={players[1]} isMe={players[1]?.id===me.id} bet={s.commits?.[players[1]?.id]?.bet}/>
        {s.result&&<div className="choiceReveal">{s.commits?.[players[1]?.id]?.choice}</div>}</div>
    </div>
    {!s.result&&!committed&&<div className="actionDock floating">
      <label className="dockBet"><span>Mise</span><input type="number" aria-label="Mise du duel" min={snap.minBet}
        max={Math.min(snap.maxBet,me.balance)} value={wager} disabled={!!opponent||busy} onChange={e=>setBet(Number(e.target.value))}/><b>Ryôs</b></label>
      {(["PILE","FACE"] as const).map(side=><button key={side} className={"casinoBtn "+(side==="PILE"?"primary":"ivory")}
        disabled={busy||!valid||!!forced&&forced!==side} onClick={()=>act("COIN_COMMIT",{bet:wager,choice:side})}>{side}</button>)}
    </div>}
    {showFinished&&<div className="roundResultBar"><div><span>MANCHE TERMINÉE</span><b>{lastEvent??"Le duel est terminé."}</b></div>
      <button className="casinoBtn ghost" onClick={next}>Prochain duel<ChevronRight size={16}/></button></div>}
  </section>;
}
