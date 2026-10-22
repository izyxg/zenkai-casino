import {expect,it} from "vitest";
import {bestPokerHand,compareScore,freshDeck,type Card} from "../lib/cards";
import {pokerHandGuide} from "../lib/poker-guide";

it.each(pokerHandGuide)("correctly classifies the help example: $name",hand=>{
  expect(bestPokerHand(hand.cards).category).toBe(hand.category);
});
const comparisons:Array<[Card[],Card[]]>=[
  [["AS","2H","3D","4C","5S"],["2S","3H","4D","5C","6S"]],
  [["AS","AH","KD","QC","9S"],["AC","AD","KH","QH","TS"]],
  [["AS","AH","KS","KH","2S"],["AC","AD","KC","KD","3S"]],
  [["KS","KH","KD","AC","AD"],["AS","AH","AD","2C","2D"]],
  [["AS","JS","9S","5S","2S"],["AH","JH","9H","5H","3H"]]
];
it.each(comparisons)("compares every relevant kicker: %j vs %j",(a,b)=>{
  expect(compareScore(bestPokerHand(a),bestPokerHand(b))).toBeLessThan(0);
});
it("uses the best five from seven, including two separate triplets",()=>{
  const hand=bestPokerHand(["AS","AH","AD","KS","KH","KD","2S"]);
  expect(hand.label).toBe("Full");expect(hand.tiebreak).toEqual([14,14,14,13,13]);
});
it("does not use a sixth card to break a tied board",()=>{
  const board:Card[]=["AS","KS","QS","JS","TS"];
  expect(compareScore(bestPokerHand([...board,"2H","3D"]),bestPokerHand([...board,"AH","AD"]))).toBe(0);
});
it("matches the best of every five-card subset for sampled seven-card hands",()=>{
  const deck=freshDeck();let seed=1927;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let sample=0;sample<(Number(process.env.POKER_SEVEN_SAMPLES)||500);sample++){
    const pool=[...deck];
    for(let i=0;i<7;i++){const j=i+Math.floor(random()*(52-i));[pool[i],pool[j]]=[pool[j],pool[i]];}
    const cards=pool.slice(0,7);let expected=bestPokerHand(cards.slice(0,5));
    for(let a=0;a<3;a++)for(let b=a+1;b<4;b++)for(let c=b+1;c<5;c++)for(let d=c+1;d<6;d++)for(let e=d+1;e<7;e++){
      const score=bestPokerHand([cards[a],cards[b],cards[c],cards[d],cards[e]]);
      if(compareScore(score,expected)>0) expected=score;
    }
    expect(compareScore(bestPokerHand(cards),expected)).toBe(0);
    expect(compareScore(bestPokerHand([...cards].reverse()),expected)).toBe(0);
  }
},120000);
it.each([["AS","AS","KD","QH","JS"],["??","2S","3D","4H","5C"],["AS","KS"]].map(cards=>({cards})))("rejects malformed hands $cards",({cards})=>{
  expect(()=>bestPokerHand(cards as Card[])).toThrow();
});
it.skipIf(process.env.POKER_EXHAUSTIVE!=="1")("counts all 2,598,960 five-card hands by category",()=>{
  const deck=freshDeck(),counts=Array(9).fill(0);
  for(let a=0;a<48;a++)for(let b=a+1;b<49;b++)for(let c=b+1;c<50;c++)for(let d=c+1;d<51;d++)for(let e=d+1;e<52;e++)
    counts[bestPokerHand([deck[a],deck[b],deck[c],deck[d],deck[e]]).category]++;
  expect(counts).toEqual([1302540,1098240,123552,54912,10200,5108,3744,624,40]);
},300000);
