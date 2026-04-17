import logoUrl from "@/assets/logo.png";

interface LogoProps {
  className?: string;
  showText?: boolean;
  variant?: "default" | "light";
}

export function Logo({ className, showText = true, variant = "default" }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <img
        src={logoUrl}
        alt="Sisteplan"
        className={`h-9 w-auto object-contain ${variant === "light" ? "brightness-0 invert" : ""}`}
      />
      {showText && (
        <span className="sr-only">Sisteplan</span>
      )}
    </div>
  );
}
