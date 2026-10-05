"use client";

import { useEffect, useState } from "react";
import { CardView } from "./CardView";
import { PlayerSeat } from "./PlayerSeat";
import { ChipStack, CHIP_DENOMS } from "./ChipStack";

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
  return ({
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

function RoundResult({text,onClose}:{text:string;onClose:()=>void}){
  return <div className="roundResultBar">
    <div><span>MANCHE TERMINÉE</span><b>{text}</b></div>
    <button className="casinoBtn ghost" onClick={onClose}>PRÉPARER LA SUITE</button>
  </div>;
}

export default function GamePanel({
  snap,
  me,
  act,
  busy=false
}:{
  snap:any;
  me:any;
  act:(action:string,payload?:any)=>Promise<void>;
  busy?:boolean;
}){
  const game=snap.game;
  const [bet,setBet]=useState(me.currentBet||snap.minBet);
  const [raise,setRaise]=useState(snap.minBet*2);
  const [dismissedResult,setDismissedResult]=useState<string|null>(null);
  const [clock,setClock]=useState(Date.now());

  useEffect(()=>{
    if(me.currentBet) setBet(me.currentBet);
  },[me.currentBet]);

  useEffect(()=>{
    const state=game?.state;
    if(state?.kind!=="POKER") return;
    const mine=state.seats?.find((x:any)=>x.playerId===me.id);
    const min=Math.max(state.currentBet+state.minRaise,(mine?.roundBet??0)+1);
    const max=(mine?.roundBet??0)+me.balance;
    setRaise((value)=>Math.max(min,Math.min(value,max)));
  },[game?.id,game?.state?.currentBet,game?.state?.minRaise,game?.state?.currentIndex,me.id,me.balance]);

  const lastEvt=snap.events?.[snap.events.length-1];
  const lastEvent=lastEvt?.message;
  const recentFinished=game?.status==="FINISHED"&&game?.endedAt&&Date.now()-new Date(game.endedAt).getTime()<20000;
  const showFinished=!!recentFinished&&dismissedResult!==game?.id;

  if(!game||(game.status!=="ACTIVE"&&!showFinished)){
    const blackjack=snap.gameType==="BLACKJACK";
    const poker=snap.gameType==="POKER";
    const coin=snap.gameType==="COINFLIP";
    const hostDealer=blackjack&&snap.blackjackDealerMode==="HOST";
    const canBet=blackjack&&!(hostDealer&&me.isHost);

    const blackjackEligible=snap.players.filter((p:any)=>{
      if(hostDealer&&p.isHost) return false;
      return p.currentBet>=snap.minBet&&p.currentBet<=snap.maxBet&&p.currentBet<=p.balance;
    }).length;
    const pokerEligible=snap.players.filter((p:any)=>p.balance>=snap.minBet).length;

    const startReady=blackjack
      ?blackjackEligible>0
      :poker
        ?pokerEligible>=2
        :snap.players.length===2;

    const startReason=blackjack
      ?(startReady?blackjackEligible+" mise"+(blackjackEligible>1?"s":"")+" prête"+(blackjackEligible>1?"s":""):"Au moins 1 mise doit être confirmée")
      :poker
        ?(startReady?pokerEligible+" joueurs prêts":"Au moins 2 joueurs avec assez de Ryôs")
        :(startReady?"Les 2 joueurs sont présents":"Il faut exactement 2 joueurs");

    if(blackjack){
      const maxPlayable=Math.min(snap.maxBet,me.balance);
      const rack=CHIP_DENOMS.filter((value)=>value<=snap.maxBet&&value>=Math.min(100,snap.minBet)).slice(0,7).reverse();
      const seatPlayers=snap.players.filter((p:any)=>!(hostDealer&&p.isHost));
      const dealerHost=hostDealer?snap.players.find((p:any)=>p.isHost):null;

      return <section className="gameStage blackjackLobbyStage">
        <div className="stageAmbient"/>

        <div className="blackjackLobbyTopbar">
          <div>
            <span className="roundEyebrow">BLACKJACK • TABLE OUVERTE</span>
            <b>Prends place et pose tes jetons</b>
          </div>
          <div className={"manualDealStatus "+(startReady?"ready":"")}>
            <span>{startReady?"PRÊT À JOUER":"EN ATTENTE"}</span>
            <b>{blackjackEligible}</b>
            <small>mise{blackjackEligible>1?"s":""} confirmée{blackjackEligible>1?"s":""}</small>
          </div>
        </div>

        <div className="felt blackjackFelt premiumBlackjackFelt blackjackBettingFelt">
          <div className="feltBorder"/>
          <div className="blackjackInnerLine"/>
          <div className="tableBranding blackjackBranding bettingBrand">
            <span>LE CERCLE DU RYÔ</span>
            <b>BLACKJACK</b>
            <small>POSE TES JETONS • L’HÔTE LANCE LA DISTRIBUTION</small>
          </div>

          <div className="pregameDealer">
            <div className="premiumDealer staticDealer">
              <div className="dealerHead"><i/></div>
              <div className="dealerBody"><i/><i/><strong/></div>
              <div className="dealerBow">◆</div>
              <div className="dealerHands"><span/><span/></div>
            </div>
            <div className="pregameDealerPlaque">
              <span>{hostDealer?"CROUPIER HÔTE":"LA MAISON"}</span>
              <b>{dealerHost?.name??"Croupier"}</b>
              <small>{startReady?"La table est prête":"En attente d'une mise"}</small>
            </div>
          </div>

          <div className="pregameSeats">
            {seatPlayers.map((p:any,index:number)=>{
              const hasBet=p.currentBet>=snap.minBet;
              return <div className={"pregameSeat "+(p.id===me.id?"me ":"")+(hasBet?"ready":"")} key={p.id}>
                <div className="pregameSeatHead">
                  <div className="pregameAvatar">{p.name.split(/\s+/).slice(0,2).map((x:string)=>x[0]?.toUpperCase()).join("")}</div>
                  <div>
                    <b>{p.name}</b>
                    <span>{p.id===me.id?"TON SIÈGE":p.isHost?"HÔTE":"JOUEUR"}</span>
                  </div>
                  <strong>{fmt(p.balance)}<small>Ryôs</small></strong>
                </div>
                <div className="betSpot">
                  <span className="betSpotLabel">{hasBet?"MISE POSÉE":"MISE"}</span>
                  <ChipStack amount={p.currentBet} compact={false}/>
                  <b>{hasBet?fmt(p.currentBet):"—"} <small>Ryôs</small></b>
                  {hasBet&&<em>PRÊT</em>}
                </div>
                <div className="seatNumber">SIÈGE {index+1}</div>
              </div>;
            })}

            {Array.from({length:Math.max(0,Math.min(5,snap.maxPlayers)-seatPlayers.length)}).map((_,index)=>
              <div className="pregameSeat empty" key={"empty-"+index}>
                <div className="emptySeatIcon">＋</div>
                <span>SIÈGE LIBRE</span>
                <small>Un joueur peut rejoindre</small>
              </div>
            )}
          </div>

          <div className="tableBetMessage">
            {startReady
              ?<><i className="live"/><span>{blackjackEligible} mise{blackjackEligible>1?"s":""} prête{blackjackEligible>1?"s":""}. <b>L’hôte peut distribuer.</b></span></>
              :<><i/><span>Pose une mise pour être assis dans la prochaine manche.</span></>}
          </div>
        </div>

        <div className="bettingConsole">
          {canBet
            ?<>
              <div className="bettingIdentity">
                <span className="controlLabel">TON SOLDE</span>
                <b>{fmt(me.balance)}</b>
                <small>Ryôs disponibles</small>
              </div>

              <div className="selectedBetStack">
                <ChipStack amount={bet} compact={false}/>
                <div>
                  <span>TA MISE</span>
                  <b>{fmt(bet)}</b>
                  <small>Ryôs</small>
                </div>
              </div>

              <div className="chipRack">
                <div className="chipRackHeader">
                  <span>AJOUTER DES JETONS</span>
                  <small>Clique pour composer ta mise</small>
                </div>
                <div className="chipRackRow">
                  {rack.map((value)=><button
                    key={value}
                    disabled={busy||bet+value>maxPlayable}
                    className="rackChipButton"
                    onClick={()=>setBet(Math.min(maxPlayable,bet+value))}
                    title={"Ajouter "+fmt(value)+" Ryôs"}
                  >
                    <span className={"rackChip chip-"+value}><b>{value>=1000&&value%1000===0?(value/1000)+"K":value}</b></span>
                  </button>)}
                </div>
              </div>

              <div className="bettingAdjust">
                <button disabled={busy} onClick={()=>setBet(0)}>VIDER</button>
                <button disabled={busy} onClick={()=>setBet(Math.min(snap.minBet,maxPlayable))}>MIN</button>
                <button disabled={busy} onClick={()=>setBet(maxPlayable)}>MAX</button>
              </div>

              <div className="bettingLaunchColumn">
                <button
                  disabled={busy||bet<snap.minBet||bet>maxPlayable}
                  className="confirmBetButton"
                  onClick={()=>act("SET_BET",{bet})}
                >
                  <span>{busy?"POSE DES JETONS…":me.currentBet===bet&&bet>=snap.minBet?"MISE POSÉE":"POSER "+fmt(bet)+" RYÔS"}</span>
                  <small>Ta mise reste modifiable tant que la manche n’est pas lancée.</small>
                </button>
                {me.isHost&&<button
                  disabled={busy||!startReady}
                  className="manualDealButton"
                  onClick={()=>act("START_GAME")}
                >
                  <span>♠</span>
                  <b>DISTRIBUER</b>
                  <small>{startReady?startReason:"Il faut au moins une mise"}</small>
                </button>}
              </div>
            </>
            :<div className="dealerWaitingConsole">
              <span className="dealerIcon">♣</span>
              <div>
                <small>TON RÔLE</small>
                <b>Tu es le croupier</b>
                <p>Les joueurs posent leurs jetons. Tu décides quand distribuer les cartes.</p>
              </div>
            </div>}

          {me.isHost&&hostDealer&&<button
            disabled={busy||!startReady}
            className="manualDealButton dealerLaunch"
            onClick={()=>act("START_GAME")}
          >
            <span>♠</span>
            <b>DISTRIBUER</b>
            <small>{startReady?startReason:"Attends qu’un joueur mise"}</small>
          </button>}

          {me.isHost&&<div className="dealerModeInline">
            <span>Banque :</span>
            <button disabled={busy} className={snap.blackjackDealerMode==="AUTO"?"active":""} onClick={()=>act("SET_DEALER_MODE",{mode:"AUTO"})}>Maison</button>
            <button disabled={busy} className={snap.blackjackDealerMode==="HOST"?"active":""} onClick={()=>act("SET_DEALER_MODE",{mode:"HOST"})}>Moi</button>
          </div>}
        </div>

        {game?.status==="FINISHED"&&lastEvent&&<div className="lastResult">{lastEvent}</div>}
      </section>;
    }

    return <section className="gameStage lobbyStage">
      <div className="stageAmbient"/>
      <div className="lobbyTable">
        <div className="tableMonogram">C</div>
        <div className="lobbyKicker">TABLE EN ATTENTE</div>
        <h2>{blackjack?"Préparez les mises":poker?"Préparez la main":"Préparez le duel"}</h2>
        <p>
          {blackjack
            ?"Chaque joueur confirme sa mise avant que l'hôte ouvre la manche."
            :poker
              ?"Les blinds sont automatiques. Dès que 2 joueurs ont assez de Ryôs, l'hôte peut distribuer."
              :"À deux joueurs, l'hôte ouvre le duel puis chacun choisit son camp."}
        </p>

        {blackjack&&me.isHost&&<div className="dealerModeBox">
          <span className="controlLabel">Qui tient la banque ?</span>
          <div className="segmented">
            <button
              disabled={busy}
              className={snap.blackjackDealerMode==="AUTO"?"active":""}
              onClick={()=>act("SET_DEALER_MODE",{mode:"AUTO"})}
            >
              Maison automatique
            </button>
            <button
              disabled={busy}
              className={snap.blackjackDealerMode==="HOST"?"active":""}
              onClick={()=>act("SET_DEALER_MODE",{mode:"HOST"})}
            >
              Moi, croupier
            </button>
          </div>
          <small>
            {hostDealer
              ?"Tu ne mises pas : tu révèles, tires et règles la banque. Les cartes restent décidées par le serveur."
              :"La maison révèle et joue sa main automatiquement après le dernier joueur."}
          </small>
        </div>}

        <div className="betDock">
          {canBet&&<div className="betComposer">
            <div className="betHeader">
              <span className="controlLabel">Ta mise Blackjack</span>
              {me.currentBet>=snap.minBet&&<span className="readyBadge">✓ {fmt(me.currentBet)} prêts</span>}
            </div>
            <div className="betInputWrap">
              <button disabled={busy} onClick={()=>setBet(Math.max(snap.minBet,bet-snap.minBet))}>−</button>
              <input
                type="number"
                value={bet}
                min={snap.minBet}
                max={Math.min(snap.maxBet,me.balance)}
                onChange={e=>setBet(Number(e.target.value))}
              />
              <span>Ryôs</span>
              <button disabled={busy} onClick={()=>setBet(Math.min(snap.maxBet,me.balance,bet+snap.minBet))}>+</button>
            </div>
            <div className="quickBets">
              {[snap.minBet,Math.round((snap.minBet+snap.maxBet)/2),snap.maxBet].map((v:number)=>
                <button disabled={busy} key={v} onClick={()=>setBet(Math.min(v,me.balance))}>{fmt(v)}</button>
              )}
            </div>
            <button
              disabled={busy||bet<snap.minBet||bet>snap.maxBet||bet>me.balance}
              className="casinoBtn ghost"
              onClick={()=>act("SET_BET",{bet})}
            >
              {me.currentBet===bet?"MISE CONFIRMÉE":"CONFIRMER "+fmt(bet)+" RYÔS"}
            </button>
          </div>}

          {blackjack&&hostDealer&&me.isHost&&<div className="dealerReady">
            <div className="dealerIcon">♣</div>
            <div><b>Tu tiens le croupier</b><span>Les joueurs doivent confirmer leur mise.</span></div>
          </div>}

          {poker&&<div className="setupCard">
            <span className="setupIcon">♠</span>
            <div><b>Blinds automatiques</b><span>Petite blind {fmt(snap.minBet)} • grosse blind {fmt(Math.min(snap.maxBet,snap.minBet*2))}</span></div>
          </div>}

          {coin&&<div className="setupCard">
            <span className="setupIcon">◐</span>
            <div><b>Duel à deux</b><span>La mise et le côté se choisissent juste après l'ouverture.</span></div>
          </div>}

          {me.isHost
            ?<button
              className="casinoBtn primary startBtn"
              disabled={busy||!startReady}
              onClick={()=>act("START_GAME")}
            >
              <span>{blackjack?"DISTRIBUER":poker?"DISTRIBUER LES CARTES":"OUVRIR LE DUEL"}</span>
              <small>{startReason}</small>
            </button>
            :<div className={"waitingHost "+(startReady?"ready":"")}>
              <i/><div><b>{startReady?"Tout est prêt":"Préparation en cours"}</b><span>En attente de l'hôte</span></div>
            </div>}
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
    const entries=Object.entries(s.commits??{}) as Array<[string,any]>;
    const opponentCommit=entries.find(([id])=>id!==me.id)?.[1];
    const forcedChoice=opponentCommit?(opponentCommit.choice==="PILE"?"FACE":"PILE"):null;
    const requiredBet=opponentCommit?.bet??bet;

    return <section className="gameStage coinStage">
      <div className="stageAmbient"/>
      <div className="coinDuel">
        <div className="coinPlayer left">
          <PlayerSeat player={players[0]} isMe={players[0]?.id===me.id} bet={s.commits?.[players[0]?.id]?.bet}/>
          {s.result&&<div className="choiceReveal">{s.commits?.[players[0]?.id]?.choice??"—"}</div>}
        </div>

        <div className="coinArena">
          <span className="roundEyebrow">PILE OU FACE</span>
          <div className={"coin3d "+(s.result?"landed":"")}>
            <div className="coinFace">{s.result??"RYÔ"}</div>
          </div>
          {s.result
            ?<div className="resultCall"><b>{s.result}</b><span>{winner?.name??"Un joueur"} remporte la manche</span></div>
            :committed
              ?<div className="coinPrompt strong">Choix verrouillé. En attente de l'adversaire…</div>
              :opponentCommit
                ?<div className="coinPrompt strong">Ton adversaire a pris {opponentCommit.choice}. Tu dois prendre {forcedChoice} pour {fmt(requiredBet)} Ryôs.</div>
                :<div className="coinPrompt">Choisis ton côté et fixe la mise du duel.</div>}
        </div>

        <div className="coinPlayer right">
          <PlayerSeat player={players[1]} isMe={players[1]?.id===me.id} bet={s.commits?.[players[1]?.id]?.bet}/>
          {s.result&&<div className="choiceReveal">{s.commits?.[players[1]?.id]?.choice??"—"}</div>}
        </div>
      </div>

      {!s.result&&!committed&&<div className="actionDock floating">
        <div className="dockBet">
          <span>{opponentCommit?"Mise imposée":"Mise"}</span>
          <input
            type="number"
            value={requiredBet}
            disabled={!!opponentCommit}
            min={snap.minBet}
            max={snap.maxBet}
            onChange={e=>setBet(Number(e.target.value))}
          />
          <b>Ryôs</b>
        </div>
        <button
          disabled={busy||(!!forcedChoice&&forcedChoice!=="PILE")}
          className="casinoBtn primary"
          onClick={()=>act("COIN_COMMIT",{bet:requiredBet,choice:"PILE"})}
        >
          {forcedChoice==="FACE"?"PILE PRIS":"CHOISIR PILE"}
        </button>
        <button
          disabled={busy||(!!forcedChoice&&forcedChoice!=="FACE")}
          className="casinoBtn ivory"
          onClick={()=>act("COIN_COMMIT",{bet:requiredBet,choice:"FACE"})}
        >
          {forcedChoice==="PILE"?"FACE PRISE":"CHOISIR FACE"}
        </button>
      </div>}

      {showFinished&&<RoundResult
        text={lastEvent??((winner?.name??"Un joueur")+" remporte la manche.")}
        onClose={()=>setDismissedResult(game.id)}
      />}
    </section>;
  }

  if(s.kind==="BLACKJACK"){
    const dealerPlayer=s.dealerMode==="HOST"?snap.players.find((p:any)=>p.id===s.dealerPlayerId):undefined;
    const dealerValue=bjValue(s.dealer);
    const currentId=s.order?.[s.turnIndex];
    const activePlayer=snap.players.find((p:any)=>p.id===currentId);
    const isDealer=me.id===s.dealerPlayerId&&s.dealerMode==="HOST";
    const myHand=s.hands?.[me.id];
    const myValue=myHand?bjValue(myHand.cards):null;
    const isMyTurn=currentId===me.id&&s.dealerPhase==="PLAYERS"&&game.status==="ACTIVE";
    const tablePlayers=snap.players.filter((p:any)=>!(s.dealerMode==="HOST"&&p.id===s.dealerPlayerId));
    const canDouble=!!myHand&&myHand.cards.length===2&&me.balance>=myHand.bet;
    const motionEvt=[...(snap.events??[])].reverse().find((e:any)=>
      e.gameId===game.id&&(e.type==="BLACKJACK_DEALER"||e.type==="BLACKJACK_ACTION")
    );
    const dealerMotion=motionEvt?.type==="BLACKJACK_DEALER"&&motionEvt?.message?.toLowerCase().includes("tire");
    const playerMotion=motionEvt?.type==="BLACKJACK_ACTION"&&motionEvt?.message?.toLowerCase().includes("tire");
    const phaseLabel=game.status==="FINISHED"
      ?"MANCHE TERMINÉE"
      :s.dealerPhase==="DEALER"
        ?"TOUR DU CROUPIER"
        :isMyTurn
          ?"À TON TOUR"
          :activePlayer
            ?"TOUR DE "+activePlayer.name.toUpperCase()
            :"DISTRIBUTION";
    const dealerState=dealerValue===null
      ?"CARTE CACHÉE"
      :dealerValue>21
        ?"BUST"
        :s.dealerPhase==="DEALER"
          ?dealerValue<17?"DOIT TIRER":"PEUT RESTER"
          :"BANQUE";

    return <section className="gameStage blackjackStage">
      <div className="stageAmbient"/>
      <div className="blackjackRoundBar">
        <div className={"roundPulse "+(isMyTurn?"yourTurn":"")}><i/></div>
        <div>
          <small>BLACKJACK • MANCHE EN COURS</small>
          <b>{phaseLabel}</b>
        </div>
        <div className="roundRule"><span>RÈGLE MAISON</span><b>17</b><small>la banque reste</small></div>
      </div>

      {(dealerMotion||playerMotion)&&<div key={motionEvt.id} className={"dealMotion "+(dealerMotion?"toDealer":"toPlayer")}>
        <div className="motionCard"><span>C</span></div>
      </div>}

      <div className="felt blackjackFelt premiumBlackjackFelt">
        <div className="feltBorder"/>
        <div className="blackjackInnerLine"/>
        <div className="tableBranding blackjackBranding">
          <span>LE CERCLE DU RYÔ</span>
          <b>BLACKJACK</b>
          <small>PAYS DU VENT • TABLE PRIVÉE</small>
        </div>

        <div key={lastEvt?.id??"dealer"} className={"dealerFigure premiumDealer "+(s.dealerPhase==="DEALER"?"awake":showFinished?"reveal":"")}>
          <div className="dealerHead"><i/></div>
          <div className="dealerBody"><i/><i/><strong/></div>
          <div className="dealerBow">◆</div>
          <div className="dealerHands"><span/><span/></div>
        </div>

        <div className="dealerStation">
          <div className="dealerPlaque">
            <span>{s.dealerMode==="HOST"?"CROUPIER HÔTE":"LA MAISON"}</span>
            <b>{dealerPlayer?.name??"Croupier"}</b>
            <small>{dealerState}</small>
          </div>

          <div className="dealerHandArea">
            {s.dealer.map((card:string,i:number)=><CardView
              key={card+"-"+i}
              card={card}
              source="dealer"
              variant="premium"
              delay={i*170}
            />)}
          </div>

          <div className={"dealerValueOrb "+(dealerValue!==null&&dealerValue>21?"bust":"")}>
            <span>MAIN</span>
            <b>{dealerValue===null?"?":dealerValue}</b>
          </div>
        </div>

        <div className="blackjackBetArc" aria-hidden="true">
          <span>MISE</span><i/><span>MISE</span><i/><span>MISE</span>
        </div>

        <div className="blackjackSeats premiumSeats">
          {tablePlayers.map((p:any)=>{
            const h=s.hands?.[p.id];
            const score=h?bjValue(h.cards):undefined;
            return <PlayerSeat
              key={p.id}
              player={p}
              isMe={p.id===me.id}
              active={currentId===p.id&&s.dealerPhase==="PLAYERS"&&game.status==="ACTIVE"}
              cards={h?.cards??[]}
              status={h?statusLabel(h.status):"Spectateur"}
              bet={h?.bet??p.currentBet}
              score={score}
              table="blackjack"
              compact
            />;
          })}
        </div>

        <div className="shoeVisual premiumShoe">
          <div className="shoeStack"><i/><i/><i/></div>
          <span>♠</span><span>♥</span>
          <small>SABOT</small>
        </div>
      </div>

      {myHand&&<div className={"blackjackControlDeck "+(isMyTurn?"active":"")}>
        <div className="playerHudIdentity">
          <div className="hudAvatar">{me.name.split(/\s+/).slice(0,2).map((x:string)=>x[0]?.toUpperCase()).join("")}</div>
          <div><small>TA PLACE</small><b>{me.name}</b><span>{statusLabel(myHand.status)}</span></div>
        </div>

        <div className="hudMetric">
          <span>SOLDE</span>
          <b>{fmt(me.balance)}</b>
          <small>Ryôs</small>
        </div>
        <div className="hudMetric">
          <span>MISE</span>
          <b>{fmt(myHand.bet)}</b>
          <small>Ryôs</small>
        </div>
        <div className={"hudMetric hand "+(myValue!==null&&myValue>21?"bust":"")}>
          <span>TA MAIN</span>
          <b>{myValue===null?"?":myValue}</b>
          <small>{myValue===21?"BLACKJACK":myValue!==null&&myValue>21?"BUST":"points"}</small>
        </div>

        <div className="blackjackActions">
          {isMyTurn&&myHand.status==="PLAYING"
            ?<>
              <button disabled={busy} className="blackjackAction hit" onClick={()=>act("BLACKJACK",{move:"HIT"})}>
                <span className="actionIcon">＋</span>
                <span><b>TIRER</b><small>Recevoir une carte</small></span>
              </button>
              <button disabled={busy} className="blackjackAction stand" onClick={()=>act("BLACKJACK",{move:"STAND"})}>
                <span className="actionIcon">◆</span>
                <span><b>RESTER</b><small>Garder {myValue} points</small></span>
              </button>
              <button
                disabled={busy||!canDouble}
                title={!canDouble?"Disponible avec 2 cartes et assez de Ryôs":""}
                className="blackjackAction double"
                onClick={()=>act("BLACKJACK",{move:"DOUBLE"})}
              >
                <span className="actionIcon">×2</span>
                <span><b>DOUBLER</b><small>{canDouble?fmt(myHand.bet*2)+" Ryôs au total":"Indisponible"}</small></span>
              </button>
            </>
            :<div className="waitingTurn">
              <i/>
              <span>
                <b>{game.status==="FINISHED"?"Manche terminée":s.dealerPhase==="DEALER"?"Le croupier joue":activePlayer?"Au tour de "+activePlayer.name:"Résolution en cours"}</b>
                <small>Ta main et ton solde restent visibles ici.</small>
              </span>
            </div>}
        </div>
      </div>}

      {isDealer&&s.dealerPhase==="DEALER"&&game.status==="ACTIVE"&&<div className="dealerConsole premiumDealerConsole">
        <div className="dealerConsoleTitle">
          <span className="roundEyebrow">CONSOLE CROUPIER</span>
          <b>
            {!s.dealerRevealed
              ?"Révèle la carte cachée"
              :(dealerValue??0)<17
                ?"La banque doit encore tirer"
                :"La banque peut régler la table"}
          </b>
          <small>{dealerValue===null?"Valeur masquée":(dealerValue??0)+" points"}</small>
        </div>
        {!s.dealerRevealed
          ?<button disabled={busy} className="dealerBigAction reveal" onClick={()=>act("BLACKJACK_DEALER",{move:"REVEAL"})}>
            <span>↻</span><b>RÉVÉLER</b><small>Retourner la carte cachée</small>
          </button>
          :<>
            <button disabled={busy||(dealerValue??0)>=17} className="dealerBigAction draw" onClick={()=>act("BLACKJACK_DEALER",{move:"DRAW"})}>
              <span>＋</span><b>TIRER</b><small>Obligatoire sous 17</small>
            </button>
            <button disabled={busy||(dealerValue??0)<17} className="dealerBigAction settle" onClick={()=>act("BLACKJACK_DEALER",{move:"SETTLE"})}>
              <span>✓</span><b>RÉGLER</b><small>Distribuer les gains</small>
            </button>
          </>}
      </div>}

      {!myHand&&game.status==="ACTIVE"&&!isDealer&&<div className="spectatorHint blackjackSpectator">
        <span>MODE SPECTATEUR</span>
        {s.dealerPhase==="DEALER"
          ?"Le croupier joue sa main…"
          :activePlayer
            ?"Au tour de "+activePlayer.name+"…"
            :"La manche se règle…"}
      </div>}

      {showFinished&&<RoundResult
        text={lastEvent??("Le croupier termine à "+(dealerValue??"?")+".")}
        onClose={()=>setDismissedResult(game.id)}
      />}
    </section>;
  }

  if(s.kind==="POKER"){
    const hole=s.hole?.[me.id]??[];
    const currentSeat=s.seats[s.currentIndex];
    const turn=currentSeat?.playerId===me.id&&s.stage!=="SHOWDOWN"&&game.status==="ACTIVE";
    const mine=s.seats.find((x:any)=>x.playerId===me.id);
    const call=Math.max(0,s.currentBet-(mine?.roundBet??0));
    const minRaiseTarget=Math.max(s.currentBet+s.minRaise,(mine?.roundBet??0)+1);
    const maxRaiseTarget=(mine?.roundBet??0)+me.balance;
    const canRaise=maxRaiseTarget>=minRaiseTarget;
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
              ?<CardView key={s.board[i]+"-"+i} card={s.board[i]} source="board" delay={i*120}/>
              :<div className="cardSlot" key={i}><span>{i<3?"F":i===3?"T":"R"}</span></div>
            )}
          </div>
          <div key={s.pot} className="potDisplay"><span>POT</span><b>{fmt(s.pot)}</b><small>Ryôs</small></div>
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
                active={s.seats[s.currentIndex]?.playerId===seat.playerId&&s.stage!=="SHOWDOWN"&&game.status==="ACTIVE"}
                cards={s.hole?.[seat.playerId]??[]}
                status={seat.folded?"Couché":seat.allIn?"Tapis":seat.roundBet?fmt(seat.roundBet)+" misés":"En jeu"}
                bet={seat.roundBet}
                compact
              />
              {i===s.dealerIndex&&<span className="dealerButton">D</span>}
            </div>;
          })}
        </div>

        <div className="pokerMonogram">C</div>
      </div>

      {s.winners?.length>0&&<div className="winnerBanner">
        <span>GAGNANT</span>
        <b>{s.winners.map((w:any)=>(snap.players.find((p:any)=>p.id===w.playerId)?.name??"Joueur")+": +"+fmt(w.amount)).join(" • ")}</b>
      </div>}

      {turn&&<div className="actionDock pokerActions">
        <div className="holePreview">
          <span>Ta main</span>
          <div>{hole.map((card:string,i:number)=><CardView key={card+"-"+i} card={card} mini delay={i*90}/>)}</div>
        </div>
        <button disabled={busy} className="casinoBtn dangerSoft" onClick={()=>act("POKER",{move:"FOLD"})}>SE COUCHER</button>
        {call===0
          ?<button disabled={busy} className="casinoBtn primary" onClick={()=>act("POKER",{move:"CHECK"})}>PAROLE</button>
          :<button disabled={busy} className="casinoBtn primary" onClick={()=>act("POKER",{move:"CALL"})}>SUIVRE {fmt(call)}</button>}
        <div className="raiseControl">
          <span>Total de relance</span>
          <input
            type="number"
            min={minRaiseTarget}
            max={maxRaiseTarget}
            value={raise}
            disabled={!canRaise}
            onChange={e=>setRaise(Number(e.target.value))}
          />
        </div>
        <button
          disabled={busy||!canRaise||raise<minRaiseTarget||raise>maxRaiseTarget}
          className="casinoBtn ghost"
          onClick={()=>act("POKER",{move:"RAISE",amount:raise})}
        >
          RELANCER
        </button>
        <button disabled={busy||me.balance<=0} className="casinoBtn red" onClick={()=>act("POKER",{move:"ALLIN"})}>TAPIS</button>
      </div>}

      {game.status==="ACTIVE"&&!turn&&<div className="spectatorHint">
        {currentSeat?"Au tour de "+(snap.players.find((p:any)=>p.id===currentSeat.playerId)?.name??"un joueur")+"…":"La table avance…"}
      </div>}

      {showFinished&&<RoundResult
        text={lastEvent??"La main est terminée."}
        onClose={()=>setDismissedResult(game.id)}
      />}
    </section>;
  }

  return null;
}
