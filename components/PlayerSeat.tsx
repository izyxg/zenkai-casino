import { CardView } from "./CardView";

export function PlayerSeat({
  player,
  active=false,
  isMe=false,
  dealer=false,
  cards=[],
  status,
  bet=0,
  compact=false
}:{
  player?:any;
  active?:boolean;
  isMe?:boolean;
  dealer?:boolean;
  cards?:string[];
  status?:string;
  bet?:number;
  compact?:boolean;
}){
  const name=player?.name??(dealer?"Croupier":"Siège libre");
  const initials=name.split(/\s+/).filter(Boolean).slice(0,2).map((x:string)=>x[0]?.toUpperCase()).join("")||"•";
  return <div className={`playerSeat ${active?"isActive":""} ${isMe?"isMe":""} ${dealer?"isDealer":""} ${compact?"compact":""}`}>
    <div className="seatGlow"/>
    <div className="seatAvatar">{dealer?"♛":initials}</div>
    <div className="seatBody">
      <div className="seatNameRow">
        <strong>{name}</strong>
        {isMe&&<span className="miniTag">VOUS</span>}
        {player?.isHost&&!dealer&&<span className="miniTag gold">HÔTE</span>}
      </div>
      <div className="seatMeta">
        {dealer?<span>{status||"Maison"}</span>:<>
          <span>{player?.balance?.toLocaleString("fr-FR")??0} Ryôs</span>
          {bet>0&&<span className="seatBet">{bet.toLocaleString("fr-FR")} misés</span>}
        </>}
      </div>
      {status&&!dealer&&<div className={`seatStatus ${String(status).toLowerCase()}`}>{status}</div>}
    </div>
    {cards.length>0&&<div className="seatCards">{cards.map((c,i)=><CardView key={`${c}-${i}`} card={c} mini={compact}/>)}</div>}
    {active&&<div className="turnPill">À JOUER</div>}
  </div>
}
