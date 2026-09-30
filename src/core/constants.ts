export const GAME_NAME = 'Starfall Colony';
export const VERSION = '0.1.0';
export const TILE = 16; // sprite pixels per tile
export const TICKS_PER_SECOND = 60;
export const TICKS_PER_HOUR = 2500;
export const TICKS_PER_DAY = 60000;
export const DAYS_PER_SEASON = 15;
export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'] as const;
export const SPEED_TPS = [0, 60, 180, 360, 900];
export const MAX_PLAYERS = 4;
// factions ids reserved
export const FACTION_NONE = 0; // wild animals / world
export const FACTION_PIRATES = 1;
export const FACTION_MECHS = 2;
export const FACTION_OUTLANDERS = 3;
export const FACTION_TRIBE = 4;
export const FIRST_PLAYER_FACTION = 10;
