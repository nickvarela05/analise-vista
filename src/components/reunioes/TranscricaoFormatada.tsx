import * as React from "react";

const SPEAKER_COLORS = [
  "bg-primary/10 border-primary/30 text-primary",
  "bg-info/10 border-info/30 text-info",
  "bg-success/10 border-success/30 text-success",
  "bg-warning/10 border-warning/30 text-warning",
  "bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400",
  "bg-pink-500/10 border-pink-500/30 text-pink-600 dark:text-pink-400",
];

interface Props {
  transcricao: string;
}

/**
 * Renderiza transcrição com formato:
 *   **Falante 0:** texto...
 *
 *   **Falante 1:** texto...
 * Caso o texto não esteja formatado por falante, mostra como texto corrido.
 */
export function TranscricaoFormatada({ transcricao }: Props) {
  const segments = React.useMemo(() => {
    const blocks = transcricao.split(/\n\s*\n/).filter((b) => b.trim());
    return blocks.map((block) => {
      const m = block.match(/^\*\*Falante\s+([^:]+):\*\*\s*(.*)$/s);
      if (m) return { speaker: m[1].trim(), text: m[2].trim() };
      return { speaker: null as string | null, text: block.trim() };
    });
  }, [transcricao]);

  const speakerKeys = React.useMemo(() => {
    const seen: string[] = [];
    segments.forEach((s) => {
      if (s.speaker && !seen.includes(s.speaker)) seen.push(s.speaker);
    });
    return seen;
  }, [segments]);

  if (segments.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {segments.map((s, i) => {
        const colorIdx = s.speaker ? speakerKeys.indexOf(s.speaker) % SPEAKER_COLORS.length : -1;
        const color = colorIdx >= 0 ? SPEAKER_COLORS[colorIdx] : "bg-muted/40 border-border";
        return (
          <div key={i} className={`rounded-md border px-3 py-2 ${color}`}>
            {s.speaker && (
              <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide opacity-80">
                Falante {s.speaker}
              </p>
            )}
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
              {s.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}
