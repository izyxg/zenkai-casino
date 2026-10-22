import {BookOpen,ChevronDown} from "lucide-react";
import {CardView} from "./CardView";
import {pokerHandGuide} from "@/lib/poker-guide";
import {memo} from "react";

export default memo(function PokerGuide(){
  return <details className="pokerGuide">
    <summary><BookOpen size={15}/>Classement des mains<ChevronDown size={14}/></summary>
    <div className="pokerGuideContent">
      <p>Chacun joue contre les autres : aucune banque, aucune commission. Le pot revient aux gagnants.</p>
      <ol>{pokerHandGuide.map((hand,i)=><li key={hand.name}>
        <span className="handRank">{i+1}</span><div><b>{hand.name}</b><small>{hand.description}</small></div>
        <div className="guideCards" role="group" aria-label={"Exemple : "+hand.name}>{hand.cards.map(card=><CardView key={card} card={card} mini/>)}</div>
      </li>)}</ol>
      <p>La meilleure main utilise 5 cartes parmi les 7 disponibles, avec 0, 1 ou 2 de vos cartes privées. L'as peut être bas dans A–2–3–4–5.</p>
      <p>À combinaison égale, les valeurs des cinq cartes départagent les joueurs, jamais le symbole. Si elles sont identiques, le pot est partagé.</p>
    </div>
  </details>;
});
