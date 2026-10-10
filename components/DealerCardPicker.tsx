"use client";

import { useEffect, useRef, useState } from "react";
import type { Card, Rank, Suit } from "../lib/cards";
import { CardView } from "./CardView";

const suits:{id:Suit;symbol:string;label:string}[]=[
  {id:"S",symbol:"♠",label:"Pique"},
  {id:"H",symbol:"♥",label:"Cœur"},
  {id:"D",symbol:"♦",label:"Carreau"},
  {id:"C",symbol:"♣",label:"Trèfle"}
];
const ranks:Rank[]=["2","3","4","5","6","7","8","9","T","J","Q","K","A"];

export function DealerCardPicker({move,cards,busy,error,onChoose,onClose}:{
  move:"REVEAL"|"DRAW";
  cards:Card[];
  busy:boolean;
  error?:string;
  onChoose:(card:Card)=>Promise<void>;
  onClose:()=>void;
}){
  const dialog=useRef<HTMLDialogElement>(null);
  const [suit,setSuit]=useState<Suit>((cards[0]?.[1]??"S") as Suit);
  const [selected,setSelected]=useState<Card|null>(null);
  const available=new Set(cards);
  const canConfirm=selected!==null&&available.has(selected)&&!busy;

  useEffect(()=>{
    const element=dialog.current;
    element?.showModal();
    return()=>element?.close();
  },[]);

  return <dialog
    ref={dialog}
    className="dealerCardDialog"
    aria-labelledby="dealerCardTitle"
    aria-busy={busy}
    onCancel={event=>{event.preventDefault();if(!busy) onClose();}}
  >
    <form onSubmit={event=>{event.preventDefault();if(canConfirm) void onChoose(selected!);}}>
      <header className="dealerCardHeader">
        <span>CROUPIER HÔTE</span>
        <h2 id="dealerCardTitle">{move==="REVEAL"?"Carte à révéler":"Carte à tirer"}</h2>
        <small>{cards.length} cartes disponibles</small>
      </header>
      <fieldset className="dealerSuitTabs" disabled={busy}>
        <legend>Couleur</legend>
        {suits.map(item=><label key={item.id} className={item.id==="H"||item.id==="D"?"red":""}>
          <input
            type="radio"
            name="dealer-suit"
            value={item.id}
            checked={suit===item.id}
            onChange={()=>setSuit(item.id)}
          />
          <span><b aria-hidden="true">{item.symbol}</b>{item.label}</span>
        </label>)}
      </fieldset>
      <div className="dealerCardGrid" aria-label={"Cartes de "+suits.find(item=>item.id===suit)?.label}>
        {ranks.map(rank=>{
          const card=`${rank}${suit}` as Card;
          return <button
            type="button"
            key={card}
            className="dealerCardOption"
            aria-label={card}
            aria-pressed={selected===card}
            disabled={busy||!available.has(card)}
            onClick={()=>setSelected(card)}
            title={available.has(card)?card:"Carte déjà distribuée"}
          ><span aria-hidden="true"><CardView card={card} mini/></span></button>;
        })}
      </div>
      {cards.length===0&&<p className="dealerCardEmpty">Aucune carte disponible.</p>}
      {error&&<p className="dealerCardError" role="alert">{error}</p>}
      <footer className="dealerCardFooter">
        <span>{selected&&available.has(selected)?<CardView card={selected} mini/>:"Aucune carte choisie"}</span>
        <button type="button" className="casinoBtn ghost" disabled={busy} onClick={onClose}>Annuler</button>
        <button type="submit" className="casinoBtn primary" disabled={!canConfirm}>
          {busy?"En cours…":move==="REVEAL"?"Révéler":"Tirer"}
        </button>
      </footer>
    </form>
  </dialog>;
}
