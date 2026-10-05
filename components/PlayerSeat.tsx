import { CardView } from "./CardView";
import { ChipStack } from "./ChipStack";

export function PlayerSeat({
  player,
  active=false,
  isMe=false,
  dealer=false,
  cards=[],
  status,
  bet=0,
  compact=false,
  score,
  table="default"
}:{
  player?:any;
  active?:boolean;
  isMe?:boolean;
  dealer?:boolean;
  cards?:string[];
  status?:string;
  bet?:number;
  compact?:boolean;
  score?:number|null;
  table?:"default"|"blackjack";
}){
  const name=player?.name??(dealer?"Croupier":"Siège libre");
  const initials=name.split(/\s+/).filter(Boolean).slice(0,2).map((x:string)=>x[0]?.toUpperCase()).join("")||"•";
  const blackjack=table==="blackjack";

  return <div className={`playerSeat ${active?"isActive":""} ${isMe?"isMe":""} ${dealer?"isDealer":""} ${compact?"compact":""} ${blackjack?"blackjackSeat":""}`}>
    <div className="seatGlow"/>

    <div className="seatAvatar">{dealer?"♛":initials}</div>

    <div className="seatBody">
      <div className="seatNameRow">
        <strong>{name}</strong>
        {isMe&&<span className="miniTag">VOUS</span>}
        {player?.isHost&&!dealer&&<span className="miniTag gold">HÔTE</span>}
      </div>

      {dealer
        ?<div className="seatMeta"><span>{status||"Maison"}</span></div>
        :blackjack
          ?<div className="blackjackSeatStats">
            <span><small>SOLDE</small><b>{player?.balance?.toLocaleString("fr-FR")??0}</b><i>Ryôs</i></span>
            <span><small>MISE</small><b>{bet.toLocaleString("fr-FR")}</b><i>Ryôs</i></span>
          </div>
          :<div className="seatMeta">
            <span>{player?.balance?.toLocaleString("fr-FR")??0} Ryôs</span>
            {bet>0&&<span className="seatBet">{bet.toLocaleString("fr-FR")} misés</span>}
          </div>}

      {status&&!dealer&&<div className={`seatStatus ${String(status).toLowerCase()}`}>{status}</div>}
    </div>

    {blackjack&&score!==undefined&&<div className={`seatScore ${score!==null&&score>21?"bust":""}`}>
      <small>MAIN</small>
      <b>{score===null?"?":score}</b>
    </div>}

    {blackjack&&bet>0&&<div className="activeBetVisual">
      <ChipStack amount={bet} compact/>
      <span><small>MISE</small><b>{bet.toLocaleString("fr-FR")}</b></span>
    </div>}

    {cards.length>0&&<div className="seatCards">
      {cards.map((c,i)=><CardView
        key={`${c}-${i}`}
        card={c}
        mini={blackjack?false:compact}
        delay={i*(dealer?170:90)}
        source={dealer?"dealer":"player"}
        variant={blackjack?"premium":"standard"}
      />)}
    </div>}

    {active&&<div className="turnPill">{isMe?"À TON TOUR":"À JOUER"}</div>}
  </div>;
}
