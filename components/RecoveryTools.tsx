"use client";
import {CircleStop,SkipForward,Wrench} from "lucide-react";
import {turnKey} from "@/lib/turn-progress";

export default function RecoveryTools({game,players,busy,onRecover}:{game:any;players:any[];busy:boolean;
  onRecover:(payload:any)=>Promise<boolean>}){
  const state=game.state;
  const currentId=state.kind==="BLACKJACK"&&state.dealerPhase==="PLAYERS"?state.order[state.turnIndex]:
    state.kind==="POKER"&&state.stage!=="SHOWDOWN"?state.seats[state.currentIndex]?.playerId:undefined;
  const name=players.find(p=>p.id===currentId)?.name??"le joueur bloqué";
  const run=(mode:"REPAIR"|"SKIP"|"CANCEL")=>{
    const question=mode==="SKIP"?(state.kind==="POKER"?`Coucher la main de ${name} ? Ses mises restent dans le pot.`:
      `Faire rester ${name} avec ses cartes actuelles ?`):"Annuler la manche et rembourser toutes les mises engagées ?";
    if(mode!=="REPAIR"&&!window.confirm(question)) return;
    void onRecover({mode,gameId:game.id,turnKey:turnKey(state)});
  };
  return <details className="recoveryTools">
    <summary><Wrench size={16}/>Débloquer la table</summary>
    <div className="recoveryActions">
      <button disabled={busy} onClick={()=>run("REPAIR")}><Wrench size={16}/>Réparer les tours</button>
      <button disabled={busy||!currentId} onClick={()=>run("SKIP")}><SkipForward size={16}/>Passer {currentId?name:"le tour"}</button>
      <button className="danger" disabled={busy} onClick={()=>run("CANCEL")}><CircleStop size={16}/>Annuler et rembourser</button>
    </div>
  </details>;
}
