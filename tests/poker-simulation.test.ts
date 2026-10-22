import {beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({read:vi.fn(),update:vi.fn(),player:vi.fn(),room:vi.fn(),pay:vi.fn(),log:vi.fn(),shuffle:vi.fn()}));
vi.mock("../lib/prisma",()=>({prisma:{game:{findUniqueOrThrow:m.read,update:m.update},player:{findUniqueOrThrow:m.player},room:{update:m.room}}}));
vi.mock("../lib/games/shared",()=>({changeBalance:m.pay,logEvent:m.log}));
vi.mock("../lib/cards",async load=>({...await load<typeof import("../lib/cards")>(),shuffle:m.shuffle}));
import {newPokerState,pokerAction,beginPokerHand} from "../lib/games/poker";
import {pokerControls} from "../lib/poker-view";
let game:any,wallets:Record<string,number>,random:()=>number;
function seeded(seed:number){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
const total=()=>Object.values(wallets).reduce((a,b)=>a+b,0);
beforeEach(()=>{
  vi.clearAllMocks();wallets={};game={id:"g",roomId:"r",status:"ACTIVE"};random=seeded(1);
  m.read.mockImplementation(async()=>structuredClone(game));
  m.update.mockImplementation(async({data})=>{Object.assign(game,structuredClone(data));return game;});
  m.player.mockImplementation(async({where})=>({id:where.id,name:where.id,balance:wallets[where.id]}));
  m.pay.mockImplementation(async(_r,id,delta)=>{
    expect(Number.isSafeInteger(delta)).toBe(true);wallets[id]+=delta;
    expect(wallets[id]).toBeGreaterThanOrEqual(0);
  });
  m.shuffle.mockImplementation((input:any[])=>{
    const cards=[...input];for(let i=cards.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}return cards;
  });
});
const scenarios=Array.from({length:Number(process.env.POKER_SIMULATION_GAMES)||240},(_,i)=>({count:2+i%12,seed:i+1}));
it.each(scenarios)("conserves all chips through a complete game: $count players, seed $seed",async({count,seed})=>{
  random=seeded(seed);
  const players=Array.from({length:count},(_,i)=>({id:"p"+i,name:"Joueur "+i,balance:1+Math.floor(random()*2000)}));
  players.push({id:"host",name:"Hôte",balance:77777,isSpectator:true} as any);
  wallets=Object.fromEntries(players.map(p=>[p.id,p.balance]));
  const initial=total(),minBet=1+Math.floor(random()*30);
  game.state=await newPokerState({id:"r",players,minBet,maxBet:minBet*2});
  await beginPokerHand(game,game.state);
  let steps=0;
  while(game.status==="ACTIVE"&&steps++<400){
    const s=game.state,seat=s.seats[s.currentIndex];
    expect(seat).toBeDefined();expect(seat.folded||seat.allIn).toBe(false);
    expect(total()+s.pot).toBe(initial);
    expect(s.pot).toBe(s.seats.reduce((n:number,p:any)=>n+p.totalBet,0));
    const view=pokerControls(s,seat.playerId,wallets[seat.playerId]);
    const options:Array<{move:any;amount?:number}>=Array.from({length:6},()=>({move:view.call>0?"CALL":"CHECK"}));
    options.push({move:"FOLD"});
    if(view.canAllIn) options.push({move:"ALLIN"});
    if(view.canRaise) options.push({move:"RAISE",amount:view.presets[Math.floor(random()*view.presets.length)].amount});
    const choice=options[Math.floor(random()*options.length)];
    await pokerAction(game.id,seat.playerId,choice.move,choice.amount);
  }
  expect(steps).toBeLessThan(400);expect(game.status).toBe("FINISHED");
  expect(total()).toBe(initial);expect(wallets.host).toBe(77777);
  expect(game.state.winners.every((w:any)=>!game.state.seats.find((p:any)=>p.playerId===w.playerId).folded)).toBe(true);
  expect(game.state.winners.reduce((n:number,w:any)=>n+w.amount,0)).toBe(game.state.pot);
});

it("keeps the full big-blind bring-in when its owner has a short stack",async()=>{
  const players=[{id:"p0",balance:1000},{id:"p1",balance:1000},{id:"p2",balance:7}];
  wallets={p0:1000,p1:1000,p2:7};game.state=await newPokerState({id:"r",players,minBet:10,maxBet:20});
  expect(game.state.currentBet).toBe(20);expect(game.state.pot).toBe(17);
  await pokerAction("g","p0","CALL");await pokerAction("g","p1","CALL");
  expect(game.state.stage).toBe("FLOP");expect(game.state.pot).toBe(47);
});
it("does not make a lone funded player call an uncallable blind or bet into all-in opponents",async()=>{
  wallets={p0:1000,p1:7};
  game.state=await newPokerState({id:"r",players:[{id:"p0",balance:1000},{id:"p1",balance:7}],minBet:10,maxBet:20});
  await beginPokerHand(game,game.state);
  expect(game.status).toBe("FINISHED");expect(total()).toBe(1007);
  expect(m.pay.mock.calls.some(c=>c[1]==="p0"&&c[2]===3&&c[3]==="REFUND")).toBe(true);
});
it("rejects dry side-pot raises in the engine, not only in the buttons",async()=>{
  wallets={p0:1000,p1:80};
  game.state=await newPokerState({id:"r",players:[{id:"p0",balance:1000},{id:"p1",balance:80}],minBet:10,maxBet:20});
  await pokerAction("g","p0","CALL");await pokerAction("g","p1","ALLIN");
  const before=total();
  await expect(pokerAction("g","p0","RAISE",200)).rejects.toThrow("adversaire");
  await expect(pokerAction("g","p0","ALLIN")).rejects.toThrow("rouverte");expect(total()).toBe(before);
  await pokerAction("g","p0","CALL");expect(game.status).toBe("FINISHED");expect(total()).toBe(1080);
});
it("acts small-blind first heads-up, but big-blind first after the flop",async()=>{
  wallets={p0:1000,p1:1000};
  game.state=await newPokerState({id:"r",players:[{id:"p0",balance:1000},{id:"p1",balance:1000}],minBet:10,maxBet:20});
  expect(game.state.currentIndex).toBe(0);
  await pokerAction("g","p0","CALL");await pokerAction("g","p1","CHECK");
  expect(game.state.stage).toBe("FLOP");expect(game.state.currentIndex).toBe(1);
  await pokerAction("g","p1","CHECK");await pokerAction("g","p0","CHECK");
  expect(game.state.stage).toBe("TURN");expect(game.state.currentIndex).toBe(1);
});
it("rejects a bankroll that could overflow database balances before taking any blinds",async()=>{
  await expect(newPokerState({id:"r",minBet:10,maxBet:20,players:[{id:"p0",balance:1500000000},{id:"p1",balance:1500000000}]})).rejects.toThrow("capital");
  expect(m.pay).not.toHaveBeenCalled();
});
