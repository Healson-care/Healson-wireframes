"use client";

import { useState } from "react";
import { brandFor } from "@/lib/insurance-brands";
import { InsuranceLayer } from "@/types";

/** The layer ring colours — same hues the price blocks dot their labels with. */
const LAYER_RING: Record<InsuranceLayer, string> = {
  S: "#0f766e",
  K: "#b45309",
  B: "#1d4ed8",
  H: "#475569",
};

/**
 * A ring split evenly between the layers this insurer covers. A kupah that
 * also sold the patient a שב"ן plan is still ONE insurer, so it gets one disc
 * with a half-teal half-amber ring — rather than two identical מכבי discs
 * side by side, which is what listing layers separately produced.
 */
function ringBackground(layers: InsuranceLayer[]): string {
  if (layers.length === 1) return LAYER_RING[layers[0]];
  const slice = 360 / layers.length;
  const stops = layers
    .map((layer, i) => `${LAYER_RING[layer]} ${i * slice}deg ${(i + 1) * slice}deg`)
    .join(", ");
  return `conic-gradient(from 90deg, ${stops})`;
}

/**
 * One insurer, wearing two signals at once: the disc is the insurer's own
 * artwork or colour (who), the ring around it is the SKBH layer(s) it covers
 * her on (what it does for her). That pairing is what lets a patient connect
 * the amber-ringed מכבי disc up in her profile to the amber dot beside a
 * price further down, without either being labelled.
 *
 * A brand may declare a `logoSrc`; if the file isn't there (or fails to
 * load) this quietly falls back to the coloured initials, so the demo never
 * shows a broken image while artwork is still being collected.
 */
export function InsuranceLogo({
  name,
  layers,
  size = 30,
  title,
}: {
  name?: string | null;
  layers: InsuranceLayer[];
  size?: number;
  title?: string;
}) {
  const brand = brandFor(name);
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !!brand.logoSrc && !imageFailed;
  const ringWidth = Math.max(2, Math.round(size * 0.09));

  return (
    <span
      title={title ?? name ?? undefined}
      style={{ width: size, height: size, background: ringBackground(layers), padding: ringWidth }}
      className="inline-flex shrink-0 items-center justify-center rounded-full"
    >
      <span
        style={{ backgroundColor: showImage ? "#fff" : brand.color }}
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-full"
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.logoSrc}
            alt={name ?? ""}
            onError={() => setImageFailed(true)}
            className="h-full w-full object-contain"
          />
        ) : (
          <span style={{ fontSize: size * 0.34 }} className="font-bold leading-none text-white">
            {brand.initials}
          </span>
        )}
      </span>
    </span>
  );
}
