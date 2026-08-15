/** Action types recorded in admin audit logs */
export enum AdminEdit {
  UPDATE_PLAYER = "update_player",
  DELETE_PLAYER = "delete_player",
  DELETE_WAITLIST = "delete_waitlist",
  BAN_PLAYER_TEMPORARY = "ban_player_temporary",
  BAN_PLAYER_PERMANENT = "ban_player_permanent",
  UNBAN_PLAYER = "unban_player",
  BAN_WORKSHOP_SUGGEST = "ban_workshop_suggest",
  UNBAN_WORKSHOP_SUGGEST = "unban_workshop_suggest",
}
