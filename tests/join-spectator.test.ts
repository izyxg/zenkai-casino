import {beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({room:vi.fn(),create:vi.fn(),log:vi.fn()}));
vi.mock("../lib/prisma",()=>({withRoomMutation:(_id:string,work:()=>unknown)=>work(),prisma:{room:{findUnique:m.room,findUniqueOrThrow:m.room},player:{create:m.create}}}));
vi.mock("../lib/game-engine",()=>({logEvent:m.log}));
vi.mock("../lib/auth",()=>({hashToken:()=>"hash",newSessionToken:()=>"fixture-token"}));
import {POST} from "../app/api/rooms/join/route";
let room:any;
beforeEach(()=>{
  vi.clearAllMocks();room={id:"r",code:"TEST01",status:"LOBBY",gameType:"POKER",maxPlayers:13,startingBalance:1000,players:[]};
  m.room.mockImplementation(async()=>room);m.create.mockResolvedValue({id:"p"});
});
const join=(spectator?:unknown)=>POST(new Request("http://localhost/api/rooms/join",{method:"POST",body:JSON.stringify({name:"Visiteur",code:"TEST01",...(spectator===undefined?{}:{spectator})})}));
it("can explicitly join as spectator before a game starts",async()=>{
  expect((await join(true)).status).toBe(200);
  expect(m.create.mock.calls[0][0].data.isSpectator).toBe(true);
});
it("defaults late arrivals to spectator instead of silently enrolling them",async()=>{
  room.status="ACTIVE";expect((await join()).status).toBe(200);
  expect(m.create.mock.calls[0][0].data.isSpectator).toBe(true);
});
it("keeps the normal player default in a waiting room",async()=>{
  expect((await join()).status).toBe(200);expect(m.create.mock.calls[0][0].data.isSpectator).toBe(false);
});
it("does not accept a string as spectator consent",async()=>{
  expect((await join("true")).status).toBe(400);expect(m.create).not.toHaveBeenCalled();
});
it("allows thirteen players plus their spectator host",async()=>{
  room.players=[{name:"Hôte",isSpectator:true},...Array.from({length:12},(_,i)=>({name:"Joueur "+i,isSpectator:false}))];
  expect((await join(false)).status).toBe(200);
  room.players.push({name:"Dernier",isSpectator:false});
  expect((await join(false)).status).toBe(400);
  expect((await join(true)).status).toBe(200);
});
