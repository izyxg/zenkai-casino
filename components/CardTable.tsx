import type {CSSProperties,ReactNode} from "react";
import {CardView} from "./CardView";
import {tablePositions} from "@/lib/table-layout";

type TableProps={children:ReactNode;seats:ReactNode[];label:string;className?:string;seatsClassName?:string};

export function CardTable({children,seats,label,className="",seatsClassName=""}:TableProps) {
  const positions=tablePositions(seats.length);
  return <div className={`cardTableFrame ${seats.length>9?"crowded":""} ${className}`} role="group" aria-label={label}>
    <div className="cardTableRail" aria-hidden="true"><div/></div>
    <div className="cardTableCenter">{children}</div>
    <div className={`cardTableSeats ${seatsClassName}`}>
      {seats.map((seat,i)=><div key={i} className={`tablePosition ${positions[i].edge}`}
        style={{"--seat-x":positions[i].x+"%","--seat-y":positions[i].y+"%"} as CSSProperties}>{seat}</div>)}
    </div>
  </div>;
}

type SeatProps={name?:string;balance?:number;cards?:string[];bet?:number;score?:number|null;
  status?:string;isMe?:boolean;active?:boolean;folded?:boolean;badges?:ReactNode;className?:string};
const fmt=(value:number)=>value.toLocaleString("fr-FR");

export function TablePlayer({name,balance=0,cards=[],bet=0,score,status,isMe,active,folded,badges,className=""}:SeatProps) {
  return <article className={`cardTableSeat ${isMe?"mine":""} ${active?"active":""} ${folded?"folded":""} ${!name?"vacant":""} ${className}`}
    aria-label={(name??"Place libre")+(isMe?", vous":"")+(active?", à jouer":"")}>
    <div className="tableSeatPlaque">
      <div className="tableSeatName"><strong title={name}>{name??"Place libre"}</strong>{badges}</div>
      {name&&<div className="tableSeatBalance">{fmt(balance)} <small>Ryôs</small>{isMe&&<span>Vous</span>}</div>}
    </div>
    {cards.length>0&&<div className="tableSeatHand" aria-label={"Main de "+name}>
      <div className="tableSeatCards" style={{"--hand-size":cards.length} as CSSProperties}>
        {cards.map((card,i)=><CardView key={card+i} card={card} mini delay={i*60}/>)}</div>
      {score!==undefined&&<b className={`tableSeatScore ${score!==null&&score>21?"bust":""}`} aria-label="Points de la main">{score??"?"}</b>}
    </div>}
    {name&&<div className="tableSeatState">{bet>0&&<span className="tableSeatBet"><i aria-hidden="true"/>{fmt(bet)}</span>}
      <span>{active?"À jouer":status}</span></div>}
  </article>;
}
