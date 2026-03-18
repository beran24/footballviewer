import type { SavedPlaySummary } from "../GameStateProvider";

type SavedPlaysModalProps = {
  isOpen: boolean;
  plays: SavedPlaySummary[];
  onLoad: (id: string) => void;
  onClose: () => void;
};

const formatSavedAt = (isoValue: string) => {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleString();
};

export function SavedPlaysModal({
  isOpen,
  plays,
  onLoad,
  onClose,
}: SavedPlaysModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-100">
            Load Saved Play
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
          {plays.length === 0 ? (
            <p className="rounded-md border border-slate-700 bg-slate-800/60 p-3 text-sm text-slate-300">
              No saved plays yet.
            </p>
          ) : (
            plays.map((play) => (
              <div
                key={play.id}
                className="flex items-center justify-between gap-3 rounded-md border border-slate-700 bg-slate-800/60 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-100">
                    {play.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    Saved: {formatSavedAt(play.updatedAt)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onLoad(play.id)}
                  className="shrink-0 rounded-md border border-emerald-500/60 bg-emerald-600/20 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-600/30"
                >
                  Load
                </button>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
