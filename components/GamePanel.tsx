" use client";

import { useEffect, useState } from "react";
import { CardView } from "./CardView";
import { PlayerSeat } from "./PlayerSeat";

const fmt=(n:number)=>Number(n||0).toLocaleString("fr-FR");

function bjValue(cards:string[]){
  if(cards.some(c=>c==="??")) return null;
  let total=0,aces=0;
  for(const card of cards){
    const r=card[0];
    if(r==="A"){total+=11;aces++;}
    else if(["T","J","Q","K"].includes(r)) total+=10;
    else total+=Number(r);
  }
  while(total>21&&aces>0){total-=10;aces--;}
  return total;
}

function statusLabel(status?:string){
  return (x
    PLAYING:"En jeu",
    STAND:"Reste",
    BUST:"Bust",
    BLACKJACK:"Blackjack",
    DONE:"Terminé",
    PREFLOP:"Préflop",
    FLOP:"Flop",
    TURN:"Turn",
    RIVER:"River",
    SHOWDOWN:"Showdown"
  } as Record<string,string>)[status??""]??status??"";
}

const ringPositions=[
  {left:"50%",top:"88%"},
  {left:"18%",top:"77%"},
  {left:"82%",top:"77%"},
  {left:"8%",top:"46%"},
  {left:"92%",top:"46%"},
  {left:"19%",top:"17%"},
  {left:"81%",top:"17%"},
  {left:"50%",top:"8%"}
];

export default function GamePanel({
  snap,
  me,
  act
}:{
  snap:any;
  me:any;
  act:(action:string,payload?:any)=>Promise<void>;
}){
  const game=snap.game;
  const [bet,setBet]=useState(me.currentBet||snap.minBet);
  const [raise,setRaise]=useState(snap.minBet*2);

  useEffect(()=>{
    if(me.currentBet) setBet(me.currentBet);
  },[me.currentBet]);

  const lastEvent=snap.events?.[snap.events.length-1]?.message;

  if(!game||game.status!=="ACTIVE"){
    const hostDealer=snap.gameType==="BLACKJACK"&&snap.blackjackDealerMode==="HOST";
    const canBet=!(hostDealer&&me.isHost);
    return <section className="gameStage lobbyStage">
      <div className="stageAmbient"/>
      <div className="lobbyTable">
        <div className="tableMonogram">Z</div>
        <div className="lobbyKicker">TABLE EN ATTENTE</div>
        <h2>Préparez la prochaine manche</h2>
        <p>Choisis ta mise, rassemble les joueurs et laisse l'hôte ouvrir la table.</p>

        {snap.gameType==="BLACKJACK"&&me.isHost&&<div className="dealerModeBox">
          <span className="controlLabel">Mode croupier</span>
          <div className="segmented">
            <button
              className={snap.blackjackDealerMode==="AUTO"?"active":""}
              onClick={()=>act("SET_DEALER_MODE",{mode:"AUTO"})}
            >
              Croupier automatique
            </button>
            <button
              className={snap.blackjackDealerMode==="HOST"?"active":""}
              onClick={()=>act("SET_DEALER_MODE",{mode:"HOST"})}
            >
              Je prends le croupier
            </button>
          </div>
          <small>
            {snap.blackjackDealerMode==="HOST"
              ?"Tu animes la table : révélation, tirage et règlement. Les r礧les restent verrouillées côté serveur."
              :"Le serveur joue automatiquement la main du croupier."}
          </small>
        </div>}

        <div className="betDock">
          {canBet?<div className="betComposer">
            <span className="controlLabel">Ta mise</span>
            <div className="betInputWrap">
              <button onClick={()=>setBet(Math.max(snap.minBet,bet-snap.minBet))}>−</button>
              <input
                type="number"
                value={bet}
                min={snap.minBet}
                max={Math.min(snap.maxBet,me.balance)}
                onChange={e=>setBet(Number(e.target.value))}
              />
              <span>Ryôs</span>
              <button onClick={()=>setBet(Math.min(snap.maxBet,me.balance,bet+snap.minBet))}>+</button>
            </div>
            <div className="quickBets">
              {[snap.minBet,Math.round((snap.minBet+snap.maxBet)/2),snap.maxBet].map((v number)=>
                <button key={v} onClick={()=>setBet(Math.min(v,me.balance))}>{fmt(v)}</button>
              )}
            </div>
            <button className="casinoBtn ghost" onClick={()=>act("SET_BET",{bet})}>
              Confirmer {fmt(bet)} Ryôs
            </button>
          </div>:<div className="dealerReady">
            <div className="dealerIcon">♣</div>
            <div><b>Tu es le croupier</b><span>Les autres joueurs préparent leurs mises.</span></div>
          </div>}

          {me.isHost&&<button className="casinoBtn primary startBtn" onClick={()=>act("START_GAME")}>
            <span>OUVRIR LA TABLE</span>
            <small>Lancer la manche</small>
          </button>}
        </div>

        <div className="limitLine">
          <span>Mise min <b>{fmt(snap.minBet)}</b></span>
          <i/>
          <span>Mise max <b>{fmt(snap.maxBet)}</b></span>
          <i/>
          <span>{snap.players.length}/{snap.maxPlayers} joueurs</span>
        </div>

        {game?.status==="FINISHED"&&lastEvent&&<div className="lastResult">{lastEvent}</div>}
      </div>
    </section>;
  }

  const s=game.state;

  if(s.kind==="COINFLIP"){
    const committed=s.commits?.[me.id];
    const players=snap.players.slice(0,2);
    const winner=s.winnerId?snap.players.find((p:any)=>p.id===s.winnerId):null;

    return <section className="gameStage coinStage">
      <div className="stageAmbient"/>
      <div className="coinDuel">
        <div className="coinPlayer left">
          <PlayerSeat player={players[0]} isMe={players[0]?.id===me.id} bet={s.commits?.[players[0]?.id]?.bet}/>
          {s.result&&<div className="choiceReveal">{s.commits?.[players[0]?.id]?.choice??"—"</div>}
        </div>

        <div className="coinArena">
          <span className="roundEyebrow">PILE OU FACE</span>
          <div className=x`coin3d ${s.result?"landed":""}`>
<div className="coinFace">{s.result??"RYÔ"</div>
          </div>
          {s.result
            ?<div className="resultCall"><b>{s.result}</b><span>{winner?.name??"un joueur"} remporte la manche</span></div>
            :<div className="coinPrompt">{committed?"Choix verrouillé. On attend l'adversaire.":"Choisis ton camp et verrouille ta mise."}</div>}
        </div>

        <div className="coinPlayer right">
          <PlayerSeat player={players[1]} isMe={players[1]?.id===me.id} bet={s.commits?.[players[1]?.id]?.bet}/>
          {s.result&&<div className="choiceReveal">{s.commits?.[players[1]?.id]?.choice??""}</div>}
        </div>
      </div>

      {!s.result&&!committed&&<div className="actionDock floating">
        <div className="dockBet">
          <span>Mise</span>
          <input type="number" value={bet} min={snap.minBet} max={snap.maxBet} onChange={e=>setBet(Number(e.target.value))}/>
          <b>Ryôs</b>
        </div>
        <button className="casinoBtn primary" onClick={()=>act("COIN_COMMIT",{bet,choice:"PILE"})}>PILE</button>
        <button className="casinoBtn ivory" onClick={()=>act("COIN_COMMIT",{bet,choice:"FACE"})}>FACE</button>
      </div>}
    </section>;
  }

  if(s.kind==="BLACKJACK"){
    const dealerPlayer=s.idealerMode==="HOST"?snap.players.find((p:any)=>p.id===s.dealerPlayerId):undefined;
    const dealerValue=bjValue(s.dealer);
    const currentId=s.order?.[s.turnIndex];
    const isDealer=me.id===s.dealerPlayerId&&s.dealerMode==="HOST";
    const myHand=s.hands?.[me.id];
    const is^MyTurn=currentId===me.id&&s.dealerPhase==="PLAYERS";
    const tablePlayers=snap.players.filter((p:any)=>!(s.dealerMode==="HOST"&&p.id===s.dealerPlayerId));

    return <section className="gameStage blackjackStage">
      <div className="stageAmbient"/>
      <div className="felt blackjackFelt">
        <div className="feltBorder"/>
        <div className="tableBranding"><span>ZENKAI</span><b>BLACKJACK</b><small>LE CROUPIER TIRE À 16 • RESTE À 17</small></div>

        <div className="dealerZone">
          <PlayerSeat
            dealer
            player={dealerPlayer}
            active={s.dealerPhase==="DEALER"}
            cards={s.dealer}
            status={s.dealerMode==="HOST"?(dealerPlayer?.name??"Croupier hôte"):"Maison"}
          />
          <div className="dealerScore">{dealerValue===null?"?":dealerValue}</div>
        </div>

        <div className="blackjackSeats">
          {tablePlayers.map((p:any)=>{
            const h=s.hands?.[p.id];
            return <PlayerSeat
              key={p.id}
              player={p}
              isMe={p.id===me.id}
              active={currentId===p.id&&s.dealerPhase==="PLAYERS"}
              cards={h?.cards??[]}
              status={statusLabel(h?.status)}
              bet={h?.bet??p.currentBet}
              compact
            />
          })}
        </div>

        <div className="shoeVisual"><span>♠</span><span>♡</span><small>SABOT</small></div>
      </div>

      {isMyTurn&&myHand?.status==="PLAYING"&&<div className="actionDock floating">
        <div className="handReadout"><span>Ta main</span><b>{bjValue(myHand.cards)}</b></div>
        <button className="casinoBtn primary" onClick={()=>act("BLACKJACK",{move:"HIT"})}>TIRER</button>
        <button className="casinoBtn ivory" onClick={()=>act("BLACKJACK",{move:"STAND"})}>RESTER</button>
        <button className="casinoBtn ghost" onClick={()=>act("BLACKJACK",{move:"DOUBLE"})}>DOUBLER</button>
      </div>}

      {isDealer&&s.dealerPhase==="DEALER"&&<div className="dealerConsole">
        <div>
          <span className="roundEyebrow">CONSOLE CROUPIER</span>
          <b>{s.dealerRevealed?"La table attend ta décision":"Révèle ta carte cachée"}</b>
        </div>
        {!s.dealerRevealed
          ?<button className="casinoBtn primary" onClick={()=>act("BLACKJACK_DEALER",{move:"REVEAL"})}>RÉVÉLER</button>
          :<>
            <button className="casinoBtn primary" disabled={(dealerValue??0)>=17} onClick={()=>act("BLACKJACK_DEALER",{move:"DRAW"})}>TIRER</button>
            <button className="casinoBtn ivory" disabled={(dealerValue??0)<17} onClick={()=>act("BLACKJACK_DEALER",{move:"SETTLE"})}>RÉGLER LA TABLEL/button>
          </>}
      </div>}

      {!isMyTurn&&!isDealer&&<div className="spectatorHint">
        {s.dealerPhase==="DEALER"
          ?"Le croupier joue sa main…"
          :currentId
            ?`Au tour de ${snap.players.find((p:any)=>p.id===currentId)?.name??"un joueur"}… `
            :"La manche se règle…"}
      </div>}
    </section>;
  }

  if(s.kind==="POKER"){
    const hole=s.hole?.[me.id]??[];
    const currentSeat=s.seats[s.currentIndex];
    const turn=currentSeat?.playerId===me.id&&s.stage!=="SHOWDOWN";
    const mine=s.seats.find((x:any)=>x.playerId===me.id);
    const call=Math.max(0,s.currentBet-(mine?.roundBet??0));
    const seats=s.seats.map((seat:any)=>({
      ...seat,
      player:snap.players.find((p:any)=>p.id===seat.playerId)
    }));
    const stageLabel=statusLabel(s.stage);

    return <section className="gameStage pokerStage">
      <div className="stageAmbient"/>
      <div className="felt pokerFelt">
        <div className="feltBorder"/>
        <div className="pokerCenter">
          <span className="roundEyebrow">{stageLabel}</span>
          <div className="communityCards">
            {[0,1,2,3,4].map(i=>s.board[i]
              ?<CardView key={i} card={s.board[i]}/>
              :<div className="cardSlot" key={i}><span>{i<3?"F":i===3?"T":"R"}</span></div>
            )}
          </div>
          <div className="potDisplay"><span>POT</span><b>{fmt(s.pot)}</b><small>Ryôs</small></div>
        </div>

        <div className="pokerSeatRing">
          {seats.map((seat:any,i:number)=>{
            const pos=ringPositions[i]??ringPositions[0];
            return <div
              className="ringSeat"
              key={seat.playerId}
              style={{left:pos.left,top:pos.top}}
            >
              <PlayerSeat
                player={seat.player}
                isMe={seat.playerId===me.id}
                active={s.seats[s.currentIndex]?.playerId===seat.playerId&&s.stage!=="SHOWDOWN"}
                cards={s.hole?.[seat.playerId]??[]}
                status={seat.folded?"Fold":seat.allIn?"All-in":seat.roundBet?`${fmt(seat.roundBet)} misés`:"En jeu"}
                bet={seat.roundBet}
                compact
              />
              {i===s.dealerIndex&&<span className="dealerButton">D</span>}
            </div>;
          })}
        </div>

        <div className="pokerMonogram">Z</div>
      </div>

      {s.winners?.length>0&&<div className="winnerBanner">
        <span>GAGNANT</span>
        <b>{s.winners.map((w any)=>`${snap.players.find((p:any)=>p.id===w.playerId)?.name}: +${fmt(w.amount)}`).join(" • ")}</b>
      </div>}

      {turn&&<div className="actionDock pokerActions">
        <div className="holePreview">
          <span>Ta main</span>
          <div>{hole.map((c:string,i:number)=><CardView key={i} card={c} mini/>)}</div>
        </div>
        <button className="casinoBtn dangerSoft" onClick={()=>act("POKER",{move:"FOLD"})}>FOLD</button>
        {call===0
          ?<button className="casinoBtn primary" onClick={()=>act("POKER",{move:"CHECK"})}>CHECK</button>
          :<button className="casinoBtn primary" onClick={()=>act("POKER",{move:"CALL"})}>CALL {fmt(call)}</button>}
        <div className="raiseControl">
          <span>Relance</span>
          <input type="number" value={raise} onChange={e=>setRaise(Number(e.target.value))}/>
        </div>
        <button className="casinoBtn ghost" onClick={()=>act("POKER",{move:"RAISE",amount:raise})}>RAISE</button>
        <button className="casinoBtn red" onClick={()=>act("POKER",{move:"ALLIN"})}>ALL-IN</button>
      </div>}
    </section>;
  }

  return null;
}
