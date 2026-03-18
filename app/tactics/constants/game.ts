export const FIELD_WIDTH_FEET = 160;
export const COLLEGE_HASH_DISTANCE_FROM_SIDELINE_FEET = 60;
export const HASH_LEFT_PERCENT =
  (COLLEGE_HASH_DISTANCE_FROM_SIDELINE_FEET / FIELD_WIDTH_FEET) * 100;
export const HASH_RIGHT_PERCENT = 100 - HASH_LEFT_PERCENT;
export const HASH_MARK_LENGTH_PERCENT = (2 / FIELD_WIDTH_FEET) * 100;

export const TOTAL_FIELD_YARDS = 120;
export const FIELD_PLAYABLE_START_YARD = 10;
export const FIELD_PLAYABLE_END_YARD = 110;
export const PLAYABLE_FIELD_YARDS =
  FIELD_PLAYABLE_END_YARD - FIELD_PLAYABLE_START_YARD;

export const MIN_RELATIVE_FIELD_YARD = -FIELD_PLAYABLE_START_YARD;
export const MAX_RELATIVE_FIELD_YARD =
  TOTAL_FIELD_YARDS - FIELD_PLAYABLE_START_YARD;

export const YARD_LINE_INTERVAL = 10;
export const CENTER_HASH_PERCENT = (HASH_LEFT_PERCENT + HASH_RIGHT_PERCENT) / 2;
export const MIN_PLAYER_DISTANCE_FROM_LOS_YARDS = 1.2;
export const PLAYER_VERTICAL_SPREAD_FACTOR = 1.65;
export const PLAYER_COLLISION_MIN_DISTANCE_PX = 26;
export const MIN_RENDERED_DISTANCE_FROM_LOS_YARDS = 2.2;

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const toAbsoluteYard = (relativeFieldYard: number) =>
  FIELD_PLAYABLE_START_YARD +
  clamp(relativeFieldYard, MIN_RELATIVE_FIELD_YARD, MAX_RELATIVE_FIELD_YARD);

export const toTopPercentFromPlayableYard = (playableYard: number) =>
  (toAbsoluteYard(playableYard) / TOTAL_FIELD_YARDS) * 100;
