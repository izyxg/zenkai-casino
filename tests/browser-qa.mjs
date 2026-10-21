import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||"playwright");
const base=process.env.QA_URL||"http://127.0.0.1:3100";
const out=path.resolve("qa-output");
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:"msedge"});
const errors=[],actions=[],report=[];
const players=Array.from({length:13},(_,i)=>({id:"p"+i,name:i===12?"Nom de personnage très long":"Shinobi "+(i+1),
  balance:10000+i*100,currentBet:100,isHost:i===0,lastSeen:new Date().toISOString()}));
const poker={id:"g1",status:"ACTIVE",state:{kind:"POKER",deck:[],board:["AS","KH","QD"],seats:players.map((p,i)=>({
  playerId:p.id,roundBet:i===1?200:0,totalBet:i===1?200:100,folded:i===4,allIn:i===8})),
  hole:Object.fromEntries(players.map((p,i)=>[p.id,i===0?["JS","TS"]:["??","??"]])),
  dealerIndex:2,currentIndex:0,stage:"FLOP",currentBet:200,minRaise:200,bigBlind:20,pot:1500,acted:[],handLabel:"Suite"}};
const root={id:"r",code:"TEST01",gameType:"POKER",status:"ACTIVE",minBet:10,maxBet:10000,maxPlayers:13,
  startingBalance:10000,blackjackDealerMode:"HOST",locked:false,players,events:[],game:poker};
const snap=structuredClone(root);
const page=await browser.newPage();
page.on("pageerror",e=>errors.push(e.message));
try {
  await page.addInitScript(()=>localStorage.setItem("zenkai-casino:TEST01",JSON.stringify({playerId:"p0",sessionToken:"fixture-only"})));
  await page.route("**/api/rooms/TEST01**",async route=>{
    if(route.request().method()==="POST") {
      const body=route.request().postDataJSON();actions.push(body);
      if(body.action==="SET_CAPACITY")snap.maxPlayers=body.payload.maxPlayers;
      await route.fulfill({json:{ok:true,snapshot:snap}});
    } else await route.fulfill({json:snap});
  });
  await page.goto(base+"/room/TEST01",{timeout:180000});
  await page.locator(".pokerExperience").waitFor();
  await page.getByRole("button",{name:"Pot",exact:true}).click();
  assert.equal(await page.getByLabel("Total de relance",{exact:true}).inputValue(),"1900");
  await page.getByRole("button",{name:"Relancer",exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector(".busyPill"));
  assert.equal(actions.at(-1).payload.amount,1900);
  await page.getByRole("button",{name:"Tapis",exact:true}).click();
  assert.equal(actions.filter(a=>a.payload?.move==="ALLIN").length,0);
  await page.getByRole("button",{name:"Confirmer",exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector(".busyPill"));
  assert.equal(actions.at(-1).payload.move,"ALLIN");
  for(const size of [{width:1920,height:1080},{width:1366,height:768},{width:390,height:844}]) {
    await page.setViewportSize(size);
    const issues=await page.evaluate(()=>{
      const out=[];
      if(document.documentElement.scrollWidth>innerWidth+1)out.push("horizontal page overflow");
      const seats=[...document.querySelectorAll(".pokerSeat")].map(e=>e.getBoundingClientRect());
      for(let i=0;i<seats.length;i++)for(let j=i+1;j<seats.length;j++){
        const a=seats[i],b=seats[j];
        if(a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1)out.push("overlapping seats");
      }
      for(const b of document.querySelectorAll(".pokerExperience button"))if(b.scrollWidth>b.clientWidth+2)out.push("button text overflow");
      return out;
    });
    assert.deepEqual(issues,[]);
    assert.equal(await page.locator(".pokerSeat").count(),13);
    await page.screenshot({path:path.join(out,`poker-${size.width}.png`),fullPage:true});
    report.push({game:"POKER",viewport:size,seats:13,issues});
  }
  assert.deepEqual(errors,[]);
  await writeFile(path.join(out,"report.json"),JSON.stringify({report,actions:actions.map(a=>({action:a.action,payload:a.payload})),errors},null,2));
  console.log(JSON.stringify({screenshots:out,report,errors},null,2));
} finally {await browser.close();}
