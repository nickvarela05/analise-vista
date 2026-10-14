import { NexusMark } from "@/components/NexusMark";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /**
   * mark  → só o ícone (o "N" do Nexus)
   * lockup → ícone + wordmark "Nexus"
   */
  variant?: "mark" | "lockup";
  /** Força contraste claro (sobre fundos escuros) */
  onDark?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: { mark: "h-6 w-6", text: "text-sm tracking-[0.22em]" },
  md: { mark: "h-8 w-8", text: "text-base tracking-[0.22em]" },
  lg: { mark: "h-10 w-10", text: "text-lg tracking-[0.24em]" },
};

export function Logo({
  className,
  variant = "lockup",
  onDark = false,
  size = "md",
}: LogoProps) {
  const s = sizes[size];
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <NexusMark className={cn(s.mark, "drop-shadow-[0_2px_6px_rgba(47,128,115,0.25)]")} />
      {variant === "lockup" && (
        <span
          className={cn(
            "font-semibold uppercase leading-none",
            s.text,
            onDark ? "text-white/95" : "text-foreground",
          )}
        >
          Nexus
        </span>
      )}
    </div>
  );
}
