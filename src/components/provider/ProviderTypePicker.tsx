"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Building2, ChevronDown, ChevronLeft, ChevronUp } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { PROVIDER_TYPE_DESCRIPTIONS, PROVIDER_TYPE_LABELS, ProviderType } from "@/types";
import {
  PROVIDER_TYPE_ICONS,
  ProviderCategory,
  getCategory,
  manuallyOnboardedTypes,
  selfRegisterableCategories,
  typeNamesAPerson,
} from "@/lib/provider-categories";

/**
 * The first real choice of the join flow — rendered INLINE on the provider
 * dashboard (inside RegistrationProgress) rather than on a separate wizard screen,
 * so a provider who just created an account lands in their portal and picks
 * their type there. Choosing a type writes it to the draft profile and hands
 * off to /provider/register, which resumes straight into the matching form.
 */
export function ProviderTypePicker() {
  const router = useRouter();
  const currentUser = useStore((s) => s.currentUser);
  const upsertProviderProfile = useStore((s) => s.upsertProviderProfile);
  const [category, setCategory] = useState<ProviderCategory | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<ProviderCategory | null>(null);
  // Only the solo path reaches this picker at all — a medical unit's type is
  // set by Ops when the account is opened, so units are absent by construction.
  const categories = selfRegisterableCategories();
  const categoryTypes = (key: ProviderCategory) =>
    getCategory(key).types.filter((t) => categories.find((c) => c.key === key)?.types.includes(t));

  function chooseType(type: ProviderType) {
    if (!currentUser) return;
    // Mirrors the form's own selectType seeding: for an individual the display
    // name IS the account holder's name; for an organization that field names
    // the business, so the person's name moves to the contact field.
    const isPerson = typeNamesAPerson(type);
    upsertProviderProfile(currentUser.id, {
      provider_type: type,
      display_name: isPerson ? currentUser.full_name : "",
      contact_name: isPerson ? undefined : currentUser.full_name,
    });
    router.push("/provider/register");
  }

  function chooseCategory(key: ProviderCategory) {
    const types = categoryTypes(key);
    if (types.length === 1) chooseType(types[0]);
    else setCategory(key);
  }

  const cardClass =
    "group flex items-start gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-sm transition-all hover:border-primary hover:shadow-md";

  return (
    <AnimatePresence mode="wait">
      {category === null ? (
        <motion.div
          key="categories"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="grid gap-2.5 sm:grid-cols-3"
        >
          {categories.map((cfg, i) => (
            <motion.div
              key={cfg.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.25 }}
              whileHover={{ y: -2 }}
              className={cn(cardClass, "flex-col items-stretch gap-0 p-4")}
            >
              <button type="button" onClick={() => chooseCategory(cfg.key)} className="text-right">
                <span className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent-bg text-primary shadow-inner">
                  <cfg.icon className="h-5 w-5" />
                </span>
                {/* The title carries the card. Previously a 5xl-tall card was
                    filled with 11px text, which read as an empty box. */}
                <span className="block text-base font-bold leading-tight text-slate-900">{cfg.label}</span>
                <span className="mt-1 block text-[13px] leading-snug text-slate-600">{cfg.description}</span>
              </button>

              {/* "עוד פרטים" — the concrete examples are useful but secondary,
                  so they no longer stretch every card to the height of the
                  longest one. */}
              <button
                type="button"
                onClick={() => setExpandedCategory(expandedCategory === cfg.key ? null : cfg.key)}
                className="mt-2.5 flex items-center gap-1 border-t border-dashed border-slate-200 pt-2 text-[11px] font-medium text-slate-500 hover:text-primary"
                aria-expanded={expandedCategory === cfg.key}
              >
                {expandedCategory === cfg.key ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                עוד פרטים
              </button>
              <AnimatePresence initial={false}>
                {expandedCategory === cfg.key && (
                  <motion.span
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="block overflow-hidden text-[11px] leading-relaxed text-slate-500"
                  >
                    <span className="block pt-1.5">{cfg.examples}</span>
                  </motion.span>
                )}
              </AnimatePresence>

              <button
                type="button"
                onClick={() => chooseCategory(cfg.key)}
                className="mt-2.5 flex items-center gap-1 text-xs font-semibold text-primary"
              >
                בחירה
                <ChevronLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              </button>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <motion.div
          key="types"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-700">{getCategory(category).label} — מה מתאים לך?</p>
            <button
              type="button"
              onClick={() => setCategory(null)}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              חזרה לקטגוריות
            </button>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {categoryTypes(category).map((type, i) => {
              const Icon = PROVIDER_TYPE_ICONS[type];
              return (
                <motion.button
                  key={type}
                  type="button"
                  onClick={() => chooseType(type)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.2 }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.985 }}
                  className={cardClass}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent-bg text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900">{PROVIDER_TYPE_LABELS[type]}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                      {PROVIDER_TYPE_DESCRIPTIONS[type]}
                    </span>
                  </span>
                  <ChevronLeft className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:-translate-x-0.5 group-hover:text-primary" />
                </motion.button>
              );
            })}
          </div>
          {/* Units are missing from this list on purpose — say so, rather than
              leaving a מכון רפואי wondering why their type isn't offered. */}
          {manuallyOnboardedTypes(category).length > 0 && (
            <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-500">
              <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {manuallyOnboardedTypes(category)
                  .map((t) => PROVIDER_TYPE_LABELS[t])
                  .join(" ו")}{" "}
                מצטרפים בתהליך מלווה — ההסכמים נחתמים מול צוות Healson, ואנחנו פותחים לכם את המשתמש עם המבנה
                הארגוני מוכן.{" "}
                <a href="mailto:onboarding@healson.co.il" className="font-medium text-primary hover:underline">
                  דברו איתנו
                </a>
                .
              </span>
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
