import { PrismaClient, type Prisma } from "@prisma/client";
import { AsyncLocalStorage } from "node:async_hooks";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const client = globalForPrisma.prisma ?? new PrismaClient();
const transactions = new AsyncLocalStorage<Prisma.TransactionClient>();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;

// Engine helpers share the request's transaction, including their ledger writes.
export const prisma = new Proxy(client, {
  get(_target,property) {
    const tx=transactions.getStore();
    if(tx&&property==="$transaction") return (work:any)=>
      typeof work==="function"?work(tx):Promise.all(work);
    const db=tx??client;
    const value=Reflect.get(db,property);
    return typeof value==="function"?value.bind(db):value;
  }
});

export async function withRoomMutation<T>(roomId:string,work:()=>Promise<T>):Promise<T> {
  if(transactions.getStore()) return work();
  return client.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${roomId})::bigint)::text`;
    return transactions.run(tx,work);
  },{maxWait:10000,timeout:20000});
}
