import {
  FIELD_PLAYABLE_END_YARD,
  FIELD_PLAYABLE_START_YARD,
  HASH_LEFT_PERCENT,
  HASH_MARK_LENGTH_PERCENT,
  HASH_RIGHT_PERCENT,
  TOTAL_FIELD_YARDS,
  YARD_LINE_INTERVAL,
} from "../constants";

const yardLines = Array.from(
  { length: TOTAL_FIELD_YARDS / YARD_LINE_INTERVAL + 1 },
  (_, index) => {
    const yard = index * YARD_LINE_INTERVAL;
    return {
      yard,
      topPercent: (yard / TOTAL_FIELD_YARDS) * 100,
      isGoalLine:
        yard === FIELD_PLAYABLE_START_YARD || yard === FIELD_PLAYABLE_END_YARD,
      isMidfield: yard === TOTAL_FIELD_YARDS / 2,
    };
  },
);

const hashMarkYards = Array.from(
  { length: FIELD_PLAYABLE_END_YARD - FIELD_PLAYABLE_START_YARD - 1 },
  (_, index) => FIELD_PLAYABLE_START_YARD + 1 + index,
);

export function FieldBackground() {
  return (
    <>
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-800 via-emerald-900 to-emerald-800" />

      <div className="absolute inset-x-0 top-0 h-[8.333%] bg-emerald-950/70" />
      <div className="absolute inset-x-0 bottom-0 h-[8.333%] bg-emerald-950/70" />

      {yardLines.map((line) => (
        <div
          key={`yard-${line.yard}`}
          className="absolute inset-x-0"
          style={{ top: `${line.topPercent}%` }}
        >
          <div
            className={
              line.isMidfield
                ? "h-[2px] bg-white/90"
                : line.isGoalLine
                  ? "h-[2px] bg-white/85"
                  : "h-px bg-white/45"
            }
          />
        </div>
      ))}

      {hashMarkYards.map((yard) => {
        const topPercent = (yard / TOTAL_FIELD_YARDS) * 100;
        return (
          <div key={`hash-left-${yard}`}>
            <div
              className="absolute h-px bg-white/90"
              style={{
                top: `${topPercent}%`,
                left: `${HASH_LEFT_PERCENT}%`,
                width: `${HASH_MARK_LENGTH_PERCENT}%`,
                transform: "translateX(-50%)",
              }}
            />
            <div
              className="absolute h-px bg-white/90"
              style={{
                top: `${topPercent}%`,
                left: `${HASH_RIGHT_PERCENT}%`,
                width: `${HASH_MARK_LENGTH_PERCENT}%`,
                transform: "translateX(-50%)",
              }}
            />
          </div>
        );
      })}
    </>
  );
}
