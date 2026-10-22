declare module "pokersolver" {
  export class Hand {
    rank:number;
    cards:Array<{rank:number;value:string;suit:string}>;
    static solve(cards:string[],game?:string):Hand;
    static winners(hands:Hand[]):Hand[];
  }
}
