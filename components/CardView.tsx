const symbols:Record<string,string>={S:"♠",H:"♥",D:"♦",C:"♣"};

export function CardView({card,mini=false}:{card:string;mini?:boolean}){
  const hidden=card==="??";
  const rawRank=hidden?"?":card[0];
  const rank=rawRank==="T"?"10":rawRank;
  const suit=hidden?"":card[1];
  const sym=symbols[suit]??"";
  const red=suit==="H"||suit==="D";
  return <div className={`playingCard ${red?"red":""} ${hidden?"hidden":""} ${mini?"mini":""}`} aria-label={hidden?"Carte cachée":`${rank}${sym}`}>
    {!hidden&&<>
      <div className="cardCorner"><b>{rank}</b><span>{sym}</span></div>
      <div className="cardSuit">{sym}</div>
      <div className="cardCorner bottom"><b>{rank}</b><span>{sym}</span></div>
    </>}
    {hidden&&<div className="cardBackMark">Z</div>}
  </div>
}
