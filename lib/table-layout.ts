export type TablePosition={x:number;y:number;edge:"top"|"bottom"|"side"};

export function tablePositions(count:number):TablePosition[] {
  if(count<1) return [];
  const sides=count>=10?2:count>=7?1:0;
  const remaining=count-sides*2;
  const top=Math.floor(remaining/2),bottom=remaining-top;
  const row=(n:number,y:number,edge:TablePosition["edge"]):TablePosition[]=>
    Array.from({length:n},(_,i)=>({x:n===1?50:20+i*60/(n-1),y,edge}));
  const positions=[...row(top,13,"top"),...row(bottom,87,"bottom")];
  for(let i=0;i<sides;i++) {
    const y=sides===1?50:36+i*28;
    positions.push({x:7,y,edge:"side"},{x:93,y,edge:"side"});
  }
  // Start at the bottom, then continue around the table in seating order.
  positions.sort((a,b)=>Math.atan2(a.x-50,a.y-50)-Math.atan2(b.x-50,b.y-50));
  const first=positions.reduce((best,p,i)=>p.edge==="bottom"&&
    (positions[best].edge!=="bottom"||Math.abs(p.x-50)<Math.abs(positions[best].x-50))?i:best,0);
  return [...positions.slice(first),...positions.slice(0,first)];
}
