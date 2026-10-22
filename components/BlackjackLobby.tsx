"use client";
import Image from "next/image";
import {useEffect,useState} from "react";
import {Check, ChevronRight, Coins, Minus, Plus} from "lucide-react";
import {CardTable,TablePlayer} from "./CardTable";

const fmt=(n:number)=>n.toLocaleString("fr-FR");
export default function BlackjackLobby({snap,me,busy,act}:{snap:any;me:any;busy:boolean;act:(action:string,payload?:any)=>Promise<void>}) {
  const hostDealer=snap.blackjackDealerMode==="HOST";
  const isDealer=hostDealer&&me.isHost;
  const players=snap.players.filter((p:any)=>!p.isSpectator&&!(hostDealer&&p.isHost))
    .sort((a:any,b:any)=>Number(b.id===me.id)-Number(a.id===me.id));
  const max=Math.min(snap.maxBet,me.balance);
  const [draft,setDraft]=useState(String(me.currentBet||snap.minBet));
  useEffect(()=>{setDraft(String(me.currentBet||snap.minBet));},[me.currentBet,snap.minBet]);
  const bet=Number(draft);
  const valid=/^\d+$/.test(draft)&&Number.isSafeInteger(bet)&&bet>=snap.minBet&&bet<=max;
  const eligible=players.filter((p:any)=>p.currentBet>=snap.minBet&&p.currentBet<=snap.maxBet&&p.currentBet<=p.balance);
  const presets=[...new Set([snap.minBet,snap.minBet*2,snap.minBet*5,max])].filter(n=>n>=snap.minBet&&n<=max);
  return <section className="bjExperience">
    <header className="pokerHeading"><div><span className="eyebrow">LE CERCLE DU RYÔ</span><h1>Blackjack</h1></div>
      <div className="bjReady"><i/>{eligible.length} mise{eligible.length>1?"s":""} confirmée{eligible.length>1?"s":""}</div></header>
    <CardTable className="blackjackArena tableLobby" label="Tapis de blackjack" seats={Array.from({length:Math.max(players.length,Math.min(5,snap.maxPlayers-(hostDealer?1:0)))},(_,i)=>{
      const p=players[i],ready=p&&eligible.some((e:any)=>e.id===p.id);
      return <TablePlayer key={p?.id??"empty"+i} name={p?.name} balance={p?.balance} isMe={p?.id===me.id}
        bet={ready?p.currentBet:0} status={ready?"Mise confirmée":"En attente de mise"}/>;
    })}>
    <div className="bjHouse">
      <Image src="/dealer-duo.webp" alt="Les croupiers du Cercle du Ryô" width={256} height={256} priority unoptimized className="bjDealerArt"/>
      <div><span className="eyebrow">LA BANQUE</span><h2>{hostDealer?snap.players.find((p:any)=>p.isHost)?.name:"La maison"}</h2>
        <div className="bjRuleTags"><span>Blackjack paie 3:2</span><span>Banque reste à 17</span><span>Double sur 2 cartes</span></div>
      </div>
    </div>
    </CardTable>
    {me.isHost&&<div className="bjDealerSwitch" role="group" aria-label="Mode du croupier">
      <button className={hostDealer?"selected":""} disabled={busy} onClick={()=>act("SET_DEALER_MODE",{mode:"HOST"})}>Hôte croupier</button>
      <button className={!hostDealer?"selected":""} disabled={busy} onClick={()=>act("SET_DEALER_MODE",{mode:"AUTO"})}>Maison automatique</button>
    </div>}
    <div className="bjLobbyConsole">
      {!isDealer&&!me.isSpectator?<form className="bjBetForm" onSubmit={e=>{e.preventDefault();if(valid) void act("SET_BET",{bet});}}>
        <label htmlFor="blackjack-wager">Votre mise <small>{max<snap.minBet?"Solde insuffisant":fmt(snap.minBet)+" – "+fmt(max)+" Ryôs"}</small></label>
        <div className="bjBetControls">
          <button type="button" title="Diminuer la mise" aria-label="Diminuer la mise" disabled={busy||max<snap.minBet}
            onClick={()=>setDraft(String(Math.max(snap.minBet,(valid?bet:snap.minBet)-snap.minBet)))}><Minus size={16}/></button>
          <input id="blackjack-wager" type="number" step={1} min={snap.minBet} max={max} required value={draft} onChange={e=>setDraft(e.target.value)} disabled={busy||max<snap.minBet}/>
          <button type="button" title="Augmenter la mise" aria-label="Augmenter la mise" disabled={busy||max<snap.minBet}
            onClick={()=>setDraft(String(Math.min(max,(valid?bet:snap.minBet)+snap.minBet)))}><Plus size={16}/></button>
          <button type="submit" className="bjConfirmBet" disabled={busy||!valid||me.currentBet===bet}><Check size={16}/>{me.currentBet===bet?"Confirmée":"Confirmer"}</button>
        </div>
        <div className="bjBetPresets">{presets.map(n=><button type="button" key={n} disabled={busy} onClick={()=>setDraft(String(n))}>{n===max?"Max":fmt(n)}</button>)}</div>
      </form>:isDealer?<div className="bjBankReady"><Coins size={24}/><div><b>Vous tenez la banque</b><span>{eligible.length}/{players.length} joueurs prêts</span></div></div>:
        <p className="bjWaiting">Vous observez la table.</p>}
      {me.isHost?<button className="bjDealButton" disabled={busy||!eligible.length} onClick={()=>act("START_GAME")}>
        Distribuer<ChevronRight size={18}/></button>:<p className="bjWaiting">En attente de la distribution par l’hôte</p>}
    </div>
  </section>;
}
