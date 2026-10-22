import type {Card} from "./cards";

export const pokerHandGuide:Array<{name:string;description:string;cards:Card[];category:number}>=[
  {name:"Quinte flush royale",description:"Du 10 à l'as, même symbole",cards:["AS","KS","QS","JS","TS"],category:8},
  {name:"Quinte flush",description:"Cinq cartes qui se suivent, même symbole",cards:["9H","8H","7H","6H","5H"],category:8},
  {name:"Carré",description:"Quatre cartes de même valeur",cards:["AS","AH","AD","AC","9S"],category:7},
  {name:"Full",description:"Un brelan et une paire",cards:["KS","KH","KD","2C","2D"],category:6},
  {name:"Couleur",description:"Cinq cartes du même symbole",cards:["AD","JD","8D","5D","2D"],category:5},
  {name:"Quinte / suite",description:"Cinq valeurs qui se suivent",cards:["9S","8H","7D","6C","5S"],category:4},
  {name:"Brelan",description:"Trois cartes de même valeur",cards:["QS","QH","QD","8C","4D"],category:3},
  {name:"Deux paires",description:"Deux paires de valeurs différentes",cards:["JS","JH","7D","7C","6D"],category:2},
  {name:"Une paire",description:"Deux cartes de même valeur",cards:["TS","TH","9D","5C","2D"],category:1},
  {name:"Carte haute",description:"Aucune combinaison : les cartes les plus fortes",cards:["AS","KH","9D","7C","4D"],category:0}
];
