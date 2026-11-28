/**
 * Shared Kimeza Play room contracts.
 *
 * The room is game-agnostic: room membership, representation, readiness,
 * Gallery access and room conversation belong to the shared room layer.
 * A game supplies its own rules and gameplay state through game_state.
 */

export type RoomRepresentation =
  | "none"
  | "individual"
  | "buddy_group"
  | "club"
  | "zone"
  | "district";

export type RoomPlayer = {
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
  joined_at: string;
  representation: RoomRepresentation;
  represented_entity_id: string | null;
  representation_locked_at: string | null;
  is_ready: boolean;
  ready_at: string | null;
};

export type RoomStatus =
  | "draft"
  | "open"
  | "in_progress"
  | "completed"
  | "cancelled";

export type UniversalGameRoom<TGameState = Record<string, unknown>> = {
  id: string;
  title: string;
  game_code: string;
  status: RoomStatus;
  created_by: string;
  room_code: string | null;
  max_players: number;
  min_players: number;
  turn_duration_seconds: number;
  match_duration_seconds: number;
  room_expires_at: string | null;
  created_at: string;
  starts_at: string | null;
  ended_at: string | null;
  game_state: TGameState;
  players: RoomPlayer[];
  current_user_id: string;
};

export type GameRoomRules = {
  gameCode: string;
  minPlayers: number;
  maxPlayers: number;
  turnDurationOptions?: number[];
  matchDurationOptions?: number[];
  requiresAllPlayersReady: boolean;
};

export type RoomMessage = {
  id: string;
  match_id: string;
  user_id: string;
  display_name: string;
  message: string;
  message_kind: "comment" | "reaction";
  created_at: string;
};

export type RoomReaction = {
  id: number | string;
  match_id: string;
  user_id: string;
  display_name?: string;
  reaction: string;
  created_at: string;
};


export type RoomSessionStatus = "open" | "closed";
export type RoomMemberRole = "player" | "watcher";
export type RoomMemberStatus = "invited" | "active" | "left" | "revoked";

export type GameRoomSession = {
  id: string;
  title: string;
  created_by: string;
  room_code: string | null;
  status: RoomSessionStatus;
  expires_at: string | null;
  created_at: string;
  closed_at: string | null;
  members: GameRoomMember[];
};

export type GameRoomMember = {
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
  member_role: RoomMemberRole;
  status: RoomMemberStatus;
  joined_at: string | null;
};

export type GameChallengeStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "expired"
  | "launched";

export type GameChallenge = {
  id: string;
  room_session_id: string;
  game_code: string;
  challenger_id: string;
  challenger_name: string;
  challenged_id: string;
  challenged_name: string;
  status: GameChallengeStatus;
  queue_position: number | null;
  created_at: string;
  accepted_at: string | null;
  launched_at: string | null;
  launched_match_id: string | null;
};

export type GameChallengeResponse = {
  id: string;
  room_session_id: string;
  game_code: string;
  challenger_id: string;
  challenged_id: string;
  status: GameChallengeStatus;
  queue_position: number | null;
  accepted_at: string | null;
  responded_at: string;
  launch?: {
    launched: boolean;
    reason?: string;
    match_id?: string;
    room_code?: string;
    challenge_id?: string;
  };
};
