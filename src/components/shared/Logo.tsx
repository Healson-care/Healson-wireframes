import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({ size = 28, showWordmark = true, className }: { size?: number; showWordmark?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 text-primary font-bold", className)}>
      <Image
        src="/images/logo.png"
        alt="HEALSON"
        width={size}
        height={size}
        className="rounded-full shrink-0"
        priority
      />
      {showWordmark && <span>HEALSON</span>}
    </span>
  );
}
