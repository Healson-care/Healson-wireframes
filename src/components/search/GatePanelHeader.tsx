"use client";

import { ReactNode } from "react";
import { X } from "lucide-react";

/**
 * The top line of any panel that opens out of the search — a gate's option
 * list, the omnibox's suggestions. It carries the panel's own title and, on
 * the far side, the way out.
 *
 * The X earns its place because the alternatives are all guesses: tapping the
 * trigger again, tapping the page behind, or pressing Escape. Each of those
 * works, and none of them is visible. On a phone there is no Escape key and
 * "the page behind" may be entirely covered by the panel, which leaves a
 * patient who opened a gate by accident with nothing on screen to close it.
 */
export function GatePanelHeader({
  title,
  onClose,
  /** Rendered before the title — the performer gate's "back to the kinds". */
  leading,
}: {
  title: ReactNode;
  onClose: () => void;
  leading?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-1.5">
      <span className="flex min-w-0 items-center gap-1">
        {leading}
        <span className="min-w-0 truncate text-[11px] font-semibold text-slate-500">{title}</span>
      </span>
      {/* -me-1 pulls the tap target to the panel's edge without letting the
          padding push the title off-centre. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="סגירה"
        className="focus-ring -me-1 shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
