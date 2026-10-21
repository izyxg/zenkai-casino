"use client";
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { tableCapacity } from "@/lib/table-limits";

export default function CapacitySettings({gameType,capacity,occupied,disabled,onSave}:{
  gameType:string;capacity:number;occupied:number;disabled:boolean;onSave:(value:number)=>void;
}) {
  const [value,setValue]=useState(String(capacity));
  useEffect(()=>setValue(String(capacity)),[capacity]);
  if(gameType==="COINFLIP") return null;
  const n=Number(value);
  const valid=Number.isSafeInteger(n)&&n>=Math.max(2,occupied)&&n<=tableCapacity(gameType);
  return <form className="capacitySettings" onSubmit={e=>{e.preventDefault();if(valid) onSave(n);}}>
    <label htmlFor="table-capacity"><Users size={16}/>Capacité
      <input id="table-capacity" type="number" min={Math.max(2,occupied)} max={tableCapacity(gameType)}
        step={1} required value={value} disabled={disabled} onChange={e=>setValue(e.target.value)}/></label>
    <button disabled={disabled||!valid||n===capacity}>Appliquer</button>
    <span>{occupied} présents · {tableCapacity(gameType)} sièges maximum</span>
  </form>;
}
