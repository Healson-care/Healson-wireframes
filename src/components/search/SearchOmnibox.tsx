"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Clock, FileText, MapPin, Search, Stethoscope, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Offer, SearchScope, Suggestion, listEntities, suggest } from "@/lib/search";

/**
 * One box, scoped to whichever entity the patient is browsing. In service
 * scope it accepts a service name, a colloquial term ("תהודה מגנטית") or a
 * referral code; in provider scope, a provider's name or specialty. Focusing
 * an empty box opens the full list for that scope, so nothing has to be
 * guessed by name — and every path resolves to the same canonical query.
 */
export function SearchOmnibox({
  text,
  onTextChange,
  offers,
  scope,
  recents,
  onPick,
  onPickRecent,
}: {
  text: string;
  onTextChange: (next: string) => void;
  offers: Offer[];
  scope: SearchScope;
  recents: string[];
  onPick: (suggestion: Suggestion) => void;
  onPickRecent: (value: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => suggest(text, offers, scope), [text, offers, scope]);
  const fullList = useMemo(() => listEntities(offers, scope), [offers, scope]);
  const empty = text.trim().length === 0;
  const showSuggestions = focused && !empty && suggestions.length > 0;
  const showBrowse = focused && empty;
  const showRecents = showBrowse && recents.length > 0;

  useEffect(() => {
    if (!focused) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setFocused(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFocused(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [focused]);

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white/85 px-3 shadow-[0_18px_40px_-30px_rgba(20,42,79,0.4)] backdrop-blur-sm focus-within:border-[var(--brand-navy)]/35">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && suggestions.length > 0) {
              e.preventDefault();
              onPick(suggestions[0]);
              setFocused(false);
            }
          }}
          // One field, every entry point — naming them is what tells her she
          // may type a town here, which no amount of trying would reveal.
          placeholder="שירות, רופא, מכון, עיר או קוד הפניה"
          aria-label="חיפוש בקטלוג"
          className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
        {text && (
          <button
            onClick={() => onTextChange("")}
            aria-label="ניקוי החיפוש"
            className="focus-ring rounded-md p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* overscroll-contain so flicking through a long list on a phone
          doesn't start scrolling the results behind it. */}
      {(showSuggestions || showBrowse) && (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-[55vh] overflow-y-auto overscroll-contain rounded-2xl border border-white/70 bg-white/95 shadow-[0_24px_50px_-24px_rgba(20,42,79,0.5)] backdrop-blur-sm">
          {/* Sticky, so the way out stays reachable however far down the list
              she has scrolled. Deliberately NOT the X inside the input, which
              clears what she typed — this one only puts the list away and
              leaves her text alone. */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-100 bg-white/95 px-3 py-1.5 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-slate-500">
              {showBrowse ? "עיון בקטלוג" : "תוצאות מתאימות"}
            </span>
            <button
              type="button"
              onClick={() => setFocused(false)}
              aria-label="סגירת רשימת ההצעות"
              className="focus-ring -me-1 shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {showRecents && (
            <>
              <SectionLabel>חיפושים אחרונים</SectionLabel>
              {recents.map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    onPickRecent(r);
                    setFocused(false);
                  }}
                  className="focus-ring flex w-full items-center gap-2 px-3 py-3 text-right text-sm hover:bg-slate-50"
                >
                  <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  {r}
                </button>
              ))}
            </>
          )}

          {/* Nothing typed yet — the whole list for this scope, so choosing
              never depends on already knowing a name. */}
          {showBrowse && (
            <>
              {fullList.map((s) => (
                <SuggestionRow
                  key={`${s.kind}:${s.value}`}
                  suggestion={s}
                  onPick={(picked) => {
                    onPick(picked);
                    setFocused(false);
                  }}
                />
              ))}
            </>
          )}

          {showSuggestions &&
            suggestions.map((s) => (
              <SuggestionRow
                key={`${s.kind}:${s.value}`}
                suggestion={s}
                onPick={(picked) => {
                  onPick(picked);
                  setFocused(false);
                }}
              />
            ))}
        </div>
      )}
    </div>
  );
}

// No longer sticky: the panel now has its own sticky header carrying the close
// button, and two elements pinned to top-0 would sit on top of each other.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="bg-white px-3 pb-1 pt-2.5 text-[11px] font-medium text-slate-400">{children}</p>;
}

function SuggestionRow({
  suggestion,
  onPick,
}: {
  suggestion: Suggestion;
  onPick: (suggestion: Suggestion) => void;
}) {
  return (
    <button
      onClick={() => onPick(suggestion)}
      className="focus-ring flex w-full items-start gap-2.5 border-t border-slate-100 px-3 py-3 text-right hover:bg-slate-50"
    >
      <SuggestionIcon kind={suggestion.kind} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-800">{suggestion.label}</span>
        {suggestion.detail && <span className="block truncate text-xs text-slate-500">{suggestion.detail}</span>}
        {suggestion.viaSynonym && (
          <span className="block text-[11px] text-slate-400">נמצא דרך: {suggestion.viaSynonym}</span>
        )}
      </span>
    </button>
  );
}

/** The icon is what makes a blended list readable — it says which KIND of
 *  thing a row is before the label is read, so people, places, towns and
 *  services don't arrive as one undifferentiated column of text. */
function SuggestionIcon({ kind }: { kind: Suggestion["kind"] }) {
  const className = "h-4 w-4 shrink-0 mt-0.5";
  if (kind === "provider") return <Stethoscope className={cn(className, "text-primary")} />;
  if (kind === "organization") return <Building2 className={cn(className, "text-[var(--brand-navy)]/60")} />;
  if (kind === "city") return <MapPin className={cn(className, "text-teal-600")} />;
  if (kind === "referral") return <FileText className={cn(className, "text-amber-500")} />;
  return <Search className={cn(className, "text-slate-400")} />;
}
