export const LUDO_RULE_VERSION = "1.0";
export const LUDO_COLORS = ["red", "green", "yellow", "blue"] as const;
export type LudoColor = (typeof LUDO_COLORS)[number];
export type LudoToken = number; // -1 = base; 0–51 = shared track; 52–57 = home lane
export type LudoPlayer = { user_id: string; display_name: string; color: LudoColor; tokens: LudoToken[] };
export type LudoState = {
  version: string;
  players: LudoPlayer[];
  current_player_index: number;
  dice_value: number | null;
  dice_rolled: boolean;
  consecutive_sixes: number;
  winner_user_id: string | null;
  last_action: string | null;
};
export const SAFE_SQUARES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export function createLudoState(players: Array<{user_id:string;display_name:string}>, firstIndex=0): LudoState {
  if (players.length < 2 || players.length > 4) throw new Error("Ludo requires 2, 3 or 4 human players.");
  return {
    version: LUDO_RULE_VERSION,
    players: players.map((p, i) => ({...p, color:LUDO_COLORS[i], tokens:[-1,-1,-1,-1]})),
    current_player_index: firstIndex % players.length,
    dice_value:null, dice_rolled:false, consecutive_sixes:0, winner_user_id:null, last_action:null
  };
}
export function globalSquare(playerIndex:number, progress:number):number|null {
  if (progress < 0 || progress > 51) return null;
  return (playerIndex * 13 + progress) % 52;
}
export function legalLudoMoves(state:LudoState, roll:number):number[] {
  if (!Number.isInteger(roll) || roll < 1 || roll > 6 || state.winner_user_id) return [];
  const player=state.players[state.current_player_index];
  return player.tokens.flatMap((position,index)=>{
    if(position===57) return [];
    if(position===-1) return roll===6?[index]:[];
    return position+roll<=57?[index]:[];
  });
}
export function applyLudoMove(state:LudoState, tokenIndex:number):LudoState {
  if(!state.dice_rolled || !state.dice_value) throw new Error("Roll the dice before moving.");
  const roll=state.dice_value, playerIndex=state.current_player_index;
  const player=state.players[playerIndex];
  if(!legalLudoMoves(state,roll).includes(tokenIndex)) throw new Error("That token cannot make this move.");
  const next: LudoState=JSON.parse(JSON.stringify(state));
  const old=player.tokens[tokenIndex];
  const progress=old===-1?0:old+roll;
  next.players[playerIndex].tokens[tokenIndex]=progress;
  const landed=globalSquare(playerIndex,progress);
  const captured:string[]=[];
  if(landed!==null && !SAFE_SQUARES.has(landed)){
    next.players.forEach((opponent,oi)=>{
      if(oi===playerIndex)return;
      opponent.tokens.forEach((op,ti)=>{
        if(globalSquare(oi,op)===landed){next.players[oi].tokens[ti]=-1;captured.push(opponent.user_id);}
      });
    });
  }
  if(next.players[playerIndex].tokens.every(p=>p===57)) next.winner_user_id=player.user_id;
  const extra=roll===6 && next.consecutive_sixes<2;
  next.consecutive_sixes=roll===6?next.consecutive_sixes+1:0;
  next.dice_value=null;next.dice_rolled=false;
  if(!extra && !next.winner_user_id) next.current_player_index=(playerIndex+1)%next.players.length;
  next.last_action=JSON.stringify({type:"move",user_id:player.user_id,token:tokenIndex,roll,captured,extra_turn:extra});
  return next;
}
export function rollLudoDice(state:LudoState, random=Math.random):LudoState {
  if(state.winner_user_id) throw new Error("This game has finished.");
  if(state.dice_rolled) throw new Error("Move a token before rolling again.");
  const value=Math.floor(random()*6)+1;
  const next={...state,dice_value:value,dice_rolled:true};
  if(value===6 && state.consecutive_sixes>=2){
    next.dice_value=null;next.dice_rolled=false;next.consecutive_sixes=0;
    next.current_player_index=(state.current_player_index+1)%state.players.length;
    next.last_action=JSON.stringify({type:"three_sixes",user_id:state.players[state.current_player_index].user_id});
  } else next.last_action=JSON.stringify({type:"roll",user_id:state.players[state.current_player_index].user_id,value});
  return next;
}
