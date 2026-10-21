import {describe,expect,it} from "vitest";
import {tablePositions} from "../lib/table-layout";

describe("table seating",()=>{
  for(let count=1;count<=13;count++) it(`keeps ${count} seats distinct around the felt`,()=>{
    const positions=tablePositions(count);
    expect(positions).toHaveLength(count);
    expect(positions[0].edge).toBe("bottom");
    const width=count>9?100:112;
    for(let i=0;i<count;i++) for(let j=i+1;j<count;j++) {
      const dx=Math.abs(positions[i].x-positions[j].x)*7.1;
      const dy=Math.abs(positions[i].y-positions[j].y)*5.8;
      expect(dx>=width||dy>=132).toBe(true);
    }
  });
  it("has no seats for an empty room",()=>expect(tablePositions(0)).toEqual([]));
});
