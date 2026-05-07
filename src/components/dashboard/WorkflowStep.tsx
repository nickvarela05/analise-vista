import * as React from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<string, string> = {
  primary: "border-primary/30 bg-primary/5 text-primary",
  success: "border-success/30 bg-success/5 text-success",
  warning: "border-warning/40 bg-warning/5 text-warning",
  info: "border-info/30 bg-info/5 text-info",
};

function WorkflowStepImpl({
  icon: Icon,
  label,
  value,
  tone,
  to,
}: {
  icon: any;
  label: string;
  value: number;
  tone: "primary" | "success" | "warning" | "info";
  to?: string;
}) {
  const inner = (
    <>
      <Icon className="mb-1.5 h-4 w-4" />
      <p className="text-2xl font-semibold tabular-nums leading-none text-foreground">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </>
  );
  const cls = cn("workflow-step", TONE_CLASS[tone]);
  if (to) {
    return (
      <Link to={to} className={cls} aria-label={`${label}: ${value}`}>
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}

export const WorkflowStep = React.memo(WorkflowStepImpl);
