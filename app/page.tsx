"use client";

import Image from "next/image";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowRight, Coins, DoorOpen, Plus, ShieldCheck, Spade, Users} from "lucide-react";
import {CardView} from "@/components/CardView";

type GameType="BLACKJACK"|"POKER"|"COINFLIP";
const games=[{id:"BLACKJACK",name:"Blackjack",mark:"21",places:"2–13 places"},
  {id:"POKER",name:"Texas Hold’em",mark:"♠",places:"2–13 places"},
  {id:"COINFLIP",name:"Pile ou Face",mark:"◐",places:"2 places"}] as const;

export default function Home() {
  const router=useRouter();
  const [mode,setMode]=useState<"create"|"join">("join");
  const [gameType,setGameType]=useState<GameType>("BLACKJACK");
  const [capacity,setCapacity]=useState("6");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const selected=games.find(g=>g.id===gameType)!;
  async function submit(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if(busy)return;
    setBusy(true);setError("");
    const fields=Object.fromEntries(new FormData(e.currentTarget));
    try{
      const response=await fetch(mode==="create"?"/api/rooms":"/api/rooms/join",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify(mode==="create"?{...fields,gameType,maxPlayers:gameType==="COINFLIP"?2:capacity}:
          {...fields,...(fields.spectator==="on"?{spectator:true}:{})})
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"La connexion a échoué");
      localStorage.setItem("zenkai-casino:"+data.code,JSON.stringify({playerId:data.playerId,sessionToken:data.sessionToken}));
      router.push("/room/"+data.code);
    }catch(e:unknown){setError(e instanceof Error?e.message:"La connexion a échoué");setBusy(false);}
  }
  function changeMode(value:"create"|"join"){setMode(value);setError("");}

  return <main className="casinoHome">
    <header className="homeNav"><a className="logoLockup" href="/" aria-label="Le Cercle du Ryô, accueil">
      <span className="logoMark">C</span><span><b>LE CERCLE</b><small>DU RYÔ</small></span></a>
      <span className="homePrivacy"><ShieldCheck size={15}/>Maison de jeu privée</span>
    </header>
    <div className="homeTitle"><div><span className="eyebrow">MAISON DE JEU</span><h1>Le Cercle du Ryô</h1>
      <p>Votre table. Vos joueurs. La partie commence ici.</p></div><div className="homeCurrency"><Coins size={20}/><span>Ryôs<small>Monnaie de jeu</small></span></div></div>
    <div className="homeModes" role="group" aria-label="Accès au salon">
      <button className={mode==="create"?"active":""} onClick={()=>changeMode("create")} aria-pressed={mode==="create"}><Plus size={17}/>Créer une table</button>
      <button className={mode==="join"?"active":""} onClick={()=>changeMode("join")} aria-pressed={mode==="join"}><DoorOpen size={17}/>Rejoindre</button>
    </div>
    <div className="homeWorkspace">
      <section className="homeFormArea" aria-label={mode==="create"?"Création de table":"Rejoindre un salon"}>
        {mode==="create"&&<div className="homeGames" role="group" aria-label="Choix du jeu">
          {games.map(g=><button key={g.id} aria-pressed={g.id===gameType} className={g.id===gameType?"selected":""} disabled={busy}
            onClick={()=>{setGameType(g.id);setError("");}}><span>{g.id==="POKER"?<Spade size={23}/>:g.mark}</span>
            <b>{g.name}</b><small>{g.places}</small></button>)}</div>}
        <div className="homeFormHeading"><h2>{mode==="create"?selected.name:"Rejoindre le salon"}</h2>
          <span>{mode==="create"?"Nouvelle table privée":"Accès par code"}</span></div>
        {error&&<p className="homeError" role="alert">{error}</p>}
        <form className="homeForm" onSubmit={submit}>
          <div className="field full"><label htmlFor="entry-name">Nom du joueur</label>
            <input id="entry-name" name="name" placeholder="Votre personnage" minLength={2} maxLength={24} autoComplete="nickname" required disabled={busy}/></div>
          {mode==="create"?<>
            <div className="field full"><label htmlFor="creator-code">Code créateur</label>
              <input id="creator-code" name="accessCode" type="password" placeholder="Code privé" maxLength={128} autoComplete="off" required disabled={busy}/></div>
            <div className="field"><label htmlFor="min-bet">Mise minimum</label><div className="moneyInput">
              <input id="min-bet" name="minBet" type="number" min={1} max={1000000000} step={1} defaultValue={100} required disabled={busy}/><span>Ryôs</span></div></div>
            <div className="field"><label htmlFor="max-bet">Mise maximum</label><div className="moneyInput">
              <input id="max-bet" name="maxBet" type="number" min={1} max={1000000000} step={1} defaultValue={10000} required disabled={busy}/><span>Ryôs</span></div></div>
            <div className="field"><label htmlFor="max-players">Nombre de places</label>
              <input id="max-players" type="number" min={2} max={13} step={1} value={gameType==="COINFLIP"?"2":capacity}
                onChange={e=>setCapacity(e.target.value)} required disabled={busy||gameType==="COINFLIP"}/></div>
            <div className="field"><label htmlFor="starting-balance">Solde de départ</label><div className="moneyInput">
              <input id="starting-balance" name="startingBalance" type="number" min={100} max={1000000000} step={1} defaultValue={10000} required disabled={busy}/><span>Ryôs</span></div></div>
            {gameType==="BLACKJACK"&&<fieldset className="homeDealerChoice"><legend>Croupier</legend>
              <label><input type="radio" name="blackjackDealerMode" value="HOST" defaultChecked disabled={busy}/>Hôte</label>
              <label><input type="radio" name="blackjackDealerMode" value="AUTO" disabled={busy}/>Maison automatique</label></fieldset>}
          </>:<><div className="field full"><label htmlFor="join-code">Code du salon</label>
            <input id="join-code" name="code" placeholder="A7K9QX" minLength={4} maxLength={8} autoCapitalize="characters" autoComplete="off" required disabled={busy}/></div>
            <label className="homeSpectator"><input type="checkbox" name="spectator" disabled={busy}/>Rejoindre en spectateur</label></>}
          <button className="homeSubmit" disabled={busy}>{busy?"Connexion…":mode==="create"?"Ouvrir la table":"Prendre place"}<ArrowRight size={18}/></button>
        </form>
      </section>
      <aside className="homeHouse">
        <div className="homeHouseTitle"><span className="eyebrow">LE CERCLE VOUS ATTEND</span><b>La maison</b></div>
        <Image className="homeDealerArt" src="/dealer-duo.webp" alt="Les croupiers du Cercle du Ryô" width={380} height={380} priority unoptimized/>
        <div className="homeHouseCards"><CardView card="AS" variant="premium"/><CardView card="KH" variant="premium"/></div>
        <div className="homeHouseDetails"><span><Users size={15}/>Jusqu’à 13 places</span><span><ShieldCheck size={15}/>Salons sur invitation</span></div>
      </aside>
    </div>
    <footer className="homeFooter"><span>Le Cercle du Ryô</span><span>Blackjack · Texas Hold’em · Pile ou Face</span></footer>
  </main>;
}
