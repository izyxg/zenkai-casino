const DENOMS=[100000,50000,25000,10000,5000,1000,500,100];

function decompose(amount:number){
  let left=Math.max(0,Math.floor(amount));
  const chips:number[]=[];
  for(const value of DENOMS){
    while(left>=value&&chips.length<14){
      chips.push(value);
      left-=value;
    }
  }
  if(left>0&&chips.length<14) chips.push(left);
  return chips;
}

function chipClass(value:number){
  if(value>=100000) return "chip100k";
  if(value>=50000) return "chip50k";
  if(value>=25000) return "chip25k";
  if(value>=10000) return "chip10k";
  if(value>=5000) return "chip5k";
  if(value>=1000) return "chip1k";
  if(value>=500) return "chip500";
  return "chip100";
}

function short(value:number){
  if(value>=1000&&value%1000===0) return `${value/1000}K`;
  return String(value);
}

export function ChipStack({
  amount,
  compact=false,
  animated=true
}:{
  amount:number;
  compact?:boolean;
  animated?:boolean;
}){
  const chips=decompose(amount);
  if(amount<=0) return <div className={`chipStack empty ${compact?"compact":""}`}><span className="emptyChipRing"/></div>;

  return <div className={`chipStack ${compact?"compact":""}`} aria-label={`Mise de ${amount} Ryôs`}>
    {chips.map((value,index)=><div
      key={`${value}-${index}`}
      className={`casinoChip ${chipClass(value)} ${animated?"chipIn":""}`}
      style={{
        bottom:`${index*(compact?3.8:5.2)}px`,
        left:`${(index%3-1)*(compact?1.2:1.8)}px`,
        animationDelay:`${index*35}ms`
      }}
    >
      <span>{short(value)}</span>
      <i/>
    </div>)}
  </div>;
}

export const CHIP_DENOMS=DENOMS;
