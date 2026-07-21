"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { PROVIDER_TYPE_DESCRIPTIONS, PROVIDER_TYPE_LABELS, ProviderType } from "@/types";
import {
  PROVIDER_CATEGORIES,
  PROVIDER_TYPE_ICONS,
  ProviderCategory,
  getCategory,
  typeNamesAPerson,
} from "@/lib/provider-categories";

/**
 * The first real choice of the join flow — rendered INLINE on the provider
 * dashboard (inside ProviderJourney) rather than on a separate wizard screen,
 * so a provider who just created an account lands in their portal and picks
 * their type there. Choosing a type writes it to the draft profile and hands
 * off to /provider/register, which resumes straight into the matching form.
 */
export function ProviderTypePicker() {
  const router = useRouter();
  const currentUser = useStore((s) => s.currentUser);
  const upsertProviderProfile = useStore((s) => s.upsertProviderProfile);
  const [category, setCategory] = useState<ProviderCategory | null>(null);

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
    const cfg = getCategory(key);
    if (cfg.types.length === 1) chooseType(cfg.types[0]);
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
          className="grid gap-3 sm:grid-cols-3"
        >
          {PROVIDER_CATEGORIES.map((cfg, i) => (
            <motion.button
              key={cfg.key}
              type="button"
              onClick={() => chooseCategory(cfg.key)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.25 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.985 }}
              className={cn(cardClass, "flex-col items-stretch gap-0 p-5")}
            >
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent-bg text-primary shadow-inner">
                <cfg.icon className="h-6 w-6" />
              </span>
              <span className="text-sm font-bold text-slate-900">{cfg.label}</span>
              <span className="mt-1 text-xs leading-relaxed text-slate-500">{cfg.description}</span>
              <span className="mt-3 border-t border-dashed border-slate-200 pt-2.5 text-[11px] leading-relaxed text-slate-400">
                {cfg.examples}
              </span>
              <span className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary">
                בחירה
                <ChevronLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              </span>
            </motion.button>
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
            {getCategory(category).types.map((type, i) => {
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
