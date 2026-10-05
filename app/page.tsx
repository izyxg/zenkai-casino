"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const key=(code:string)=>`zenkai-casino:${code}`;
const games=[
  {id:"BLACKJACK",icon:"21",title:"Blackjack",tag:"2–8 joueurs",copy:"Affronte la maison ou laisse l'hôte prendre la place du croupier.",accent:"gold"},
  {id:"POKER",icon:"♠",title:"Texas Hold'em",tag:"2–8 joueurs",copy:"Blinds, relances, all-in et showdown autour d'une vraie table.",accent:"red"},
  {id:"COINFLIP",icon:"◐",title:"Pile ou Face",tag:"2 joueurs",copy:"Un duel rapide. Une mise. Deux camps. Une pièce au milieu.",accent:"ivory"}
] as const;

export default function Home(){
  const router=useRouter();
  const [error,setError]=useState("");
  const [creating,setCreating]=useState(false);
  const [mode,setMode]=useState<"create" | "join">("create");
  const [gameType,setGameType]=useState<"BLACKJACK" | "POKER" | "COINFLIP">("BLACKJACK");

  const selected=useMemo(()=>games.find(g=>g.id===gameType)!,[gameType]);

  function openEntry(next:"create"|"join"){
    setMode(next);
    requestAnimationFrame(()=>{
      document.getElementById("entry")?.scrollIntoView({behavior:"smooth",block:"start"});
    });
  }

  async function create(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    setCreating(true);
    setError("");
    const f=new FormData(e.currentTarget);
    const body={...Object.fromEntries(f.entries()),gameType};
    try{
      const r=await fetch("/api/rooms",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
      const d=await r.json();
      if(!r.ok) throw new Error(d.error);
      localStorage.setItem(key(d.code),JSON.stringify({playerId:d.playerId,sessionToken:d.sessionToken}));
      router.push(`/room/${d.code}`);
    }catch(e:any){
      setError(e.message);
    }finally{
      setCreating(false);
    }
  }

  async function join(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    setError("");
    const f=new FormData(e.currentTarget);
    const body=Object.fromEntries(f.entries());
    try{
      const r=await fetch("/api/rooms/join",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
      const d=await r.json();
      if(!r.ok) throw new Error(d.error);
      localStorage.setItem(key(d.code),JSON.stringify({playerId:d.playerId,sessionToken:d.sessionToken}));
      router.push(`/room/${d.code}`);
    }catch(e:any){
      setError(e.message);
    }
  }

  return <main className="landing">
    <div className="landingNoise"/>
    <nav className="landingNav">
      <a className="logoLockup" href="#">
        <span className="logoMark">C</span>
      <span><b>LE CERCLE</b><small>DU RYÔ</small></span>
      </a>
      <div className="navStatus"><i/> Maison de jeu RP • Ryôs fictifs</div>
    </nav>

    <section className="landingHero">
      <div className="heroCopy">
        <div className="eyebrow">LE CERCLE DU RYÔ • MAISON DE JEU PRIVÉE</div>
        <h1>Le désert<br/><em>ne rembourse personne.</em></h1>
        <p>Tables privées, parties entre joueurs et ambiance de maison de jeu pensée pour le RP. Ici, chaque mise existe uniquement en Ryôs fictifs.</p>
        <div className="heroActions">
          <button className="casinoBtn primary large" onClick={()=>openEntry("create")}>CRÉER UNE TABLE</button>
          <button className="casinoBtn ghost large" onClick={()=>openEntry("join")}>REJOINDRE PAR CODE</button>
        </div>
        <div className="heroStats">
          <div><b>3</b><span>jeux</span></div>
          <div><b>8</b><span>joueurs max</span></div>
          <div><b>100%</b><span>RP</span></div>
        </div>
      </div>

      <div className="heroVisual" aria-hidden="true">
        <div className="heroHalo"/>
        <div className="previewTable">
          <div className="previewEdge"/>
          <div className="previewLogo">C</div>
          <div className="previewDealer"><span>♣</span><small>CROUPIER</small></div>
          <div className="previewCards">
            <div className="fakeCard"><b>A</b><span>♠</span></div>
            <div className="fakeCard red"><b>K</b><span>♥</span></div>
            <div className="fakeCard back"/>
          </div>
          <div className="previewPot"><small>POT</small><b>25 000</b><span>Ryôs</span></div>
          <div className="previewSeat s1"><i>SN</i><span>Shuuto</span></div>
          <div className="previewSeat s2"><i>HZ</i><span>Hizuna</span></div>
          <div className="previewSeat s3"><i>IK</i><span>Izana</span></div>
        </div>
        <div className="floatingChip c1">500</div>
        <div className="floatingChip c2">1K</div>
        <div className="floatingChip c3">5K</div>
      </div>
    </section>

    <section className="gameShowcase" id="games">
      <div className="sectionHead">
        <div><span className="eyebrow">LES TABLES</span><h2>Choisis ton terrain de jeu</h2></div>
        <p>Chaque partie tourne côté serveur : les cartes, résultats et paiements ne dépendent jamais du navigateur d'un joueur.</p>
      </div>
      <div className="gameCards">
        {games.map(g=><button
          key={g.id}
          className={`gameCard ${g.accent} ${gameType===g.id?"selected":""}`}
          onClick={()=>{setGameType(g.id);openEntry("create");}}
        >
          <span className="gameIcon">{g.icon}</span>
          <span className="gameTag">{g.tag}</span>
          <strong>{g.title}</strong>
          <p>{g.copy}</p>
          <span className="gameArrow">JOUER <b>↗</b></span>
        </button>)}
      </div>
    </section>

    <section className="entrySection" id="entry">
      <div className="entryIntro">
        <span className="eyebrow">{mode==="create"?"OUVRIR UNE TABLE":"ENTRER DANS UNE ROOM"}</span>
        <h2>{mode==="create"?selected.title:"Tu as déjà un code ?"}</h2>
        <p>{mode==="create"
          ?"Configure la table, partage le code et laisse les autres joueurs te rejoindre."
          :"Entre ton pseudo RP et le code reçu. Rien d'autre n'est nécessaire."}</p>
        <div className="modeSwitch">
          <button className={mode==="create"?"active":""} onClick={()=>setMode("create")}>Créer</button>
          <button className={mode==="join"?"active":""} onClick={()=>setMode("join")}>Rejoindre</button>
        </div>
      </div>

      <div className="entryPanel">
        {error&&<div className="errorToast"><span>!</span>{error}</div>}

        {mode==="create"?<form className="casinoForm" onSubmit={create}>
          <div className="field full">
            <label>Pseudo RP</label>
            <input name="name" placeholder="Shuuto Nakae" required maxLength={24}/>
          </div>

          <div className="field full">
            <label>Jeu sélectionné</label>
            <div className="selectedGameField">
              <span className="gameIcon small">{selected.icon}</span>
              <div><b>{selected.title}</b><small>{selected.tag}</small></div>
              <button type="button" onClick={()=>document.getElementById("games")?.scrollIntoView()}>Changer</button>
            </div>
          </div>

          <div className="field">
            <label>Mise minimum</label>
            <div className="moneyInput"><input type="number" name="minBet" min="1" defaultValue="100"/><span>Ryôs</span></div>
          </div>
          <div className="field">
            <label>Mise maximum</label>
            <div className="moneyInput"><input type="number" name="maxBet" min="1" defaultValue="10000"/><span>Ryôs</span></div>
          </div>
          <div className="field">
            <label>Joueurs maximum</label>
            <input type="number" name="maxPlayers" min="2" max="8" defaultValue={gameType==="COINFLIP"?2:6} disabled={gameType==="COINFLIP"}/>
            {gameType==="COINFLIP"&&<input type="hidden" name="maxPlayers" value="2"/>}
          </div>
          <div className="field">
            <label>Solde de départ</label>
            <div className="moneyInput"><input type="number" name="startingBalance" min="100" defaultValue="10000"/><span>Ryôs</span></div>
          </div>

          <button className="casinoBtn primary submitBtn" disabled={creating}>
            <span>{creating?"CRÉATION…":"OUVRIR LA TABLE"}</span>
            <small>Un code privé sera généré</small>
          </button>
        </form>:<form className="casinoForm joinForm" onSubmit={join}>
          <div className="field full">
            <label>Pseudo RP</label>
            <input name="name" placeholder="Ton personnage" required maxLength={24}/>
          </div>
          <div className="field full">
            <label>Code de la room</label>
            <input className="codeInput" name="code" maxLength={8} placeholder="A7K9QX" required/>
          </div>
          <button className="casinoBtn primary submitBtn">
            <span>ENTRER DANS LA ROOM</span>
            <small>Connexion immédiate</small>
          </button>
        </form>}
      </div>
    </section>

    <section className="trustStrip">
      <div><span>◆</span><b>Rooms privées</b><small>Accès par code court</small></div>
      <div><span>♜</span><b>Croupier hôte</b><small>Disponible au Blackjack</small></div>
      <div><span>◎</span><b>Journal RP</b><small>Actions copiables</small></div>
      <div><span>∞</span><b>Aucune valeur réelle</b><small>Ryôs fictifs uniquement</small></div>
    </section>

    <footer className="landingFooter">
      <div className="logoLockup"><span className="logoMark">C</span><span><b>LE CERCLE</b><small>DU RYÔ</small></span></div>
      <p>Outil de roleplay non officiel. Aucun dépôt, aucun retrait, aucun argent réel.</p>
    </footer>
  </main>;
}
