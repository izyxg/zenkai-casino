export function roomPollDelay(hidden:boolean, active:boolean, failures=0) {
  if(hidden) return 15000;
  const base=active?900:1800;
  return Math.min(12000,base*2**Math.min(3,Math.max(0,failures)));
}
