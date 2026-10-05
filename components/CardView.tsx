const symbols:Record<string,string>={S:"♠",H:"♥",D:"♦",C:"♣"};

export function CardView({
  card,
  mini=false,
  delay=0,
  source="player",
  variant="standard"
}:{
  card:string;
  mini?:boolean;
  delay?:number;
  source?:"player"|"dealer"|"board";
  variant?:"standard"|"premium";
}){
  const hidden=card==="??";
  const rawRank=hidden?"?":card[0];
  const rank=rawRank==="T"?"10":rawRank;
  const suit=hidden?"":card[1];
  const sym=symbols[suit]??"";
  const red=suit==="H"||suit==="D";

  return <div
    className={`playingCard ${red?"red":""} ${hidden?"hidden":""} ${mini?"mini":""} ${variant==="premium"?"premiumCard":""} from-${source}`}
    aria-label={hidden?"Carte cachée":`${rank}${sym}`}
    style={{animationDelay:`${delay}ms`}}
  >
    <div className="cardDepth"/>
    <div className="cardSurface">
      {!hidden&&<>
        <div className="cardCorner"><b>{rank}</b><span>{sym}</span></div>
        <div className="cardSuit">{sym}</div>
        <div className="cardWatermark">{sym}</div>
        <div className="cardCorner bottom"><b>{rank}</b><span>{sym}</span></div>
      </>}
      {hidden&&<>
        <div className="cardBackPattern"/>
        <div className="cardBackFrame"/>
        <div className="cardBackMark">C</div>
      </>}
      <div className="cardSheen"/>
    </div>
  </div>;
}
