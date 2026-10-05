"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import GamePanel from "@/components/GamePanel";

const storageKey=(code:string)=>`zenkai-casino:${code}`;
const gameNames:Record<string,string>={
  COINFLIP:"Pile ou Face",
  BLACKJACK:"Blackjack",
  POKER:"Texas Hold'em"
};

export default function RoomPage({params}:{params:Promise<{code:string}>}){
  const {code}=use(params);
  const router=useRouter();
  const [session,setSession]=useState<any>(null);
  const [snap,setSnap]=useState<any>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [railTab,setRailTab]=useState<"players"|"log">("players");
  const [copied,setCopied]=useState("");
  const actionLock=useRef(false);
  const requestSeq=useRef(0);

  useEffect(()=>{
    try{
      const s=JSON.parse(localStorage.getItem(storageKey(code))||"null");
      if(!s) router.replace("/");
      else setSession(s);
    }catch{
      router.replace("/");
    }
  },[code,router]);

  const load=useCallback(async()=>{
    if(!session||actionLock.current) return;
    const seq=++requestSeq.current;
    try{
      const response=await fetch(`/api/rooms/${code}?playerId=${encodeURIComponent(session.playerId)}&token=${encodeURIComponent(session.sessionToken)}`,{cache:"no-store"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error);
      if(seq===requestSeq.current){
        setSnap(data);
        setError("");
      }
    }catch(e:any){
      if(seq===requestSeq.current) setError(e.message);
    }
  },[code,session]);

  useEffect(()=>{
    load();
    const timer=setInterval(load,900);
    return()=>clearInterval(timer);
  },[load]);

  useEffect(()=>{
    if(!error) return;
    const timer=setTimeout(()=>setError(""),4200);
    return()=>clearTimeout(timer);
  },[error]);

  async function act(action:string,payload:any={}){
    if(!session||actionLock.current) return;
    actionLock.current=true;
    requestSeq.current++;
    setBusy(true);
    setError("");

    try{
      const response=await fetch(`/api/rooms/${code}/action`,{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({playerId:session.playerId,sessionToken:session.sessionToken,action,payload})
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error);
      requestSeq.current++;
      if(data.snapshot) setSnap(data.snapshot);
    }catch(e:any){
      setError(e.message);
    }finally{
      actionLock.current=false;
      setBusy(false);
    }
  }

  const me=useMemo(()=>snap?.players?.find((p:any)=>p.id===session?.playerId),[snap,session]);
  const summary=useMemo(()=>snap?.events?.map((e:any)=>e.message).join("\n")??"",[snap]);

  function copy(value:string,label:string){
    navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(()=>setCopied(""),1400);
  }

  if(!snap||!me){
    return <main className="roomPage loadingRoom">
      <div className="loadingSeal">C</div>
      <b>Ouverture de la table…</b>
      <span>Connexion à la maison de jeu</span>
      {error&&<div className="errorToast"><span>!</span>{error}</div>}
    </main>;
  }

  const gameName=gameNames[snap.gameType]??snap.gameType;
  const isActive=snap.game?.status==="ACTIVE";
  const activeCount=snap.players.filter((p:any)=>Date.now()-new Date(p.lastSeen).getTime()<10000).length;

  return <main className="roomPage">
    <div className="roomBackdrop"/>
    <header className="roomHeader">
      <div className="roomBrand">
        <a href="/" className="logoMark">C</a>
        <div><span>LE CERCLE DU RYÔ</span><b>{gameName}</b></div>
      </div>

      <div className="roomIdentity">
        <span className="roomState"><i className={isActive?"live":""}/>{isActive?"PARTIE EN COURS":"TABLE OUVERTE"}</span>
        <button className="roomCode" onClick={()=>copy(snap.code,"code")} title="Copier le code">
          <small>SALON</small><b>{snap.code}</b><span>{copied==="code"?"COPIÉ":"COPIER"}</span>
        </button>
      </div>

      <div className="myWallet">
        <span>Ton solde</span>
        <b>{me.balance.toLocaleString("fr-FR")}</b>
        <small>Ryôs</small>
      </div>
    </header>

    {error&&<div className="globalToast errorToast"><span>!</span>{error}</div>}
    {busy&&<div className="busyPill"><i/> Action en cours</div>}

    <div className="roomLayout">
      <section className="tableColumn">
        <div className="tableToolbar">
          <div className="tableMeta">
            <span><i className="onlineDot"/>{activeCount} en ligne</span>
            <span>{snap.players.length}/{snap.maxPlayers} sièges</span>
            <span>{snap.locked?"Salon verrouillé":"Salon ouvert"}</span>
            {snap.gameType==="BLACKJACK"&&<span>{snap.blackjackDealerMode==="HOST"?"Croupier : hôte":"Croupier : maison"}</span>}
          </div>
          <button className="iconTextBtn" onClick={()=>copy(summary,"log")}>
            <span>⌘</span>{copied==="log"?"Registre copié":"Copier le registre"}
          </button>
        </div>

        <GamePanel snap={snap} me={me} act={act} busy={busy}/>

        {me.isHost&&<section className="hostDeck">
          <div className="hostDeckTitle">
            <div><span className="eyebrow">MAÎTRE DE TABLE</span><b>Gestion du salon</b></div>
            <small>Disponible entre les manches pour les actions sensibles.</small>
          </div>
          <div className="hostActions">
            <button className="hostAction" disabled={busy} onClick={()=>act("LOCK",{locked:!snap.locked})}>
              <span>{snap.locked?"⌁":"⌾"}</span>
              <div><b>{snap.locked?"Déverrouiller":"Verrouiller"}</b><small>Contrôler les entrées</small></div>
            </button>
            <button className="hostAction" disabled={busy||isActive} onClick={()=>act("RESET_BALANCES")}>
              <span>↻</span>
              <div><b>Reset soldes</b><small>Remettre tout le monde à {snap.startingBalance.toLocaleString("fr-FR")}</small></div>
            </button>
            <button className="hostAction danger" disabled={busy||isActive} onClick={()=>act("CLOSE")}>
              <span>×</span>
              <div><b>Fermer le salon</b><small>Mettre fin à cette table</small></div>
            </button>
          </div>
        </section>}
      </section>

      <aside className="sideRail">
        <div className="railTabs">
          <button className={railTab==="players"?"active":""} onClick={()=>setRailTab("players")}>Joueurs <b>{snap.players.length}</b></button>
          <button className={railTab==="log"?"active":""} onClick={()=>setRailTab("log")}>Journal <b>{snap.events.length}</b></button>
        </div>

        {railTab==="players"?<div className="railContent playerRail">
          <div className="railSectionTitle"><span>TABLE</span><small>{snap.players.length}/{snap.maxPlayers}</small></div>
          <div className="playerList">
            {snap.players.map((p:any)=>{
              const online=Date.now()-new Date(p.lastSeen).getTime()<10000;
              const initials=p.name.split(/\s+/).slice(0,2).map((x:string)=>x[0]?.toUpperCase()).join("");
              return <div className={`railPlayer ${p.id===me.id?"me":""}`} key={p.id}>
                <div className="railAvatar">{initials}<i className={online?"on":""}/></div>
                <div className="railPlayerInfo">
                  <div><b>{p.name}</b>{p.isHost&&<span className="miniTag gold">HÔTE</span>}</div>
                  <span>{p.currentBet>0?`${p.currentBet.toLocaleString("fr-FR")} Ryôs misés`:"Aucune mise"}</span>
                </div>
                <div className="railBalance">{p.balance.toLocaleString("fr-FR")}<small>Ryôs</small></div>
                {me.isHost&&!p.isHost&&!isActive&&<button disabled={busy} className="kickBtn" onClick={()=>act("KICK",{playerId:p.id})} title="Expulser">×</button>}
              </div>;
            })}
          </div>

          <div className="roomLimits">
            <div><span>Mise min</span><b>{snap.minBet.toLocaleString("fr-FR")}</b></div>
            <div><span>Mise max</span><b>{snap.maxBet.toLocaleString("fr-FR")}</b></div>
            <div><span>Départ</span><b>{snap.startingBalance.toLocaleString("fr-FR")}</b></div>
          </div>
        </div>:<div className="railContent logRail">
          <div className="railSectionTitle"><span>REGISTRE</span><button onClick={()=>copy(summary,"log")}>{copied==="log"?"Copié":"Copier tout"}</button></div>
          <div className="eventFeed">
            {snap.events.length===0&&<div className="emptyLog">La table est silencieuse pour l'instant.</div>}
            {snap.events.map((e:any,i:number)=><div className="feedEvent" key={e.id}>
              <div className="eventRail"><i/><span>{String(i+1).padStart(2,"0")}</span></div>
              <div>
                <time>{new Date(e.createdAt).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</time>
                <p>{e.message}</p>
              </div>
            </div>)}
          </div>
        </div>}

        <div className="railFooter">
          <span>Ryôs fictifs</span>
          <small>Aucun argent réel • aucun retrait</small>
        </div>
      </aside>
    </div>
  </main>;
}
