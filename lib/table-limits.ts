export const MAX_TABLE_PLAYERS = 13;
export const MAX_ROOM_MEMBERS = 64;

export function occupiedSeats(players:Array<{isSpectator?:boolean}>){
  return players.filter(p=>!p.isSpectator).length;
}

export function tableCapacity(gameType: string) {
  return gameType === "COINFLIP" ? 2 : MAX_TABLE_PLAYERS;
}

export function validateCapacity(gameType: string, value: unknown, occupied = 0) {
  if (!Number.isSafeInteger(value) || (value as number) < 2 || (value as number) > tableCapacity(gameType)) {
    throw new Error(`Choisis entre 2 et ${tableCapacity(gameType)} sièges`);
  }
  if (gameType === "COINFLIP" && value !== 2) throw new Error("Pile ou Face se joue à 2");
  if ((value as number) < occupied) throw new Error("La limite ne peut pas être inférieure au nombre de joueurs présents");
  return value as number;
}
