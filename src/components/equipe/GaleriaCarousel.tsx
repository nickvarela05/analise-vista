import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Images, Loader2, Pause, Play } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Foto {
  id: string;
  foto_url: string;
  legenda: string | null;
  ordem: number;
  created_at?: string;
}

const AUTOPLAY_MS = 30_000;

export function GaleriaCarousel() {
  const [current, setCurrent] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  const { data: fotos, isLoading } = useQuery({
    queryKey: ["galeria-equipe"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaborador_galeria")
        .select("*")
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Foto[];
    },
  });

  const total = fotos?.length ?? 0;

  const go = React.useCallback(
    (dir: 1 | -1) => {
      if (!total) return;
      setCurrent((c) => (c + dir + total) % total);
    },
    [total],
  );

  const goTo = React.useCallback(
    (i: number) => {
      if (!total) return;
      setCurrent(((i % total) + total) % total);
    },
    [total],
  );

  // Autoplay 30s
  React.useEffect(() => {
    if (paused || total <= 1) return;
    const id = window.setInterval(() => {
      setCurrent((c) => (c + 1) % total);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [paused, total]);

  // Reset index if list shrinks
  React.useEffect(() => {
    if (current >= total && total > 0) setCurrent(0);
  }, [current, total]);

  // Keyboard navigation
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex h-64 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!fotos || total === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
          <Images className="h-8 w-8 opacity-50" />
          Nenhuma foto na galeria ainda.
        </CardContent>
      </Card>
    );
  }

  const active = fotos[current] ?? fotos[0];
  const prevIdx = (current - 1 + total) % total;
  const nextIdx = (current + 1) % total;

  return (
    <Card
      className="overflow-hidden border-border/60 bg-card"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <CardContent
        className="p-3 sm:p-4"
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label="Galeria da equipe"
        onKeyDown={onKeyDown}
      >
        <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
          {/* Hero preview */}
          <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-muted/60 to-muted ring-1 ring-border/50">
            {/* Blurred backdrop preserves aspect without cropping */}
            <img
              key={`bg-${active.id}`}
              src={active.foto_url}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
            />
            <div className="relative flex aspect-[16/9] w-full items-center justify-center">
              <img
                key={active.id}
                src={active.foto_url}
                alt={active.legenda ?? "Foto da equipe"}
                className="max-h-full max-w-full object-contain transition-opacity duration-500 animate-in fade-in"
              />
            </div>

            {/* Gradient + caption */}
            {active.legenda && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
                <p className="text-sm font-medium text-white drop-shadow">{active.legenda}</p>
              </div>
            )}

            {/* Counter */}
            <div className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
              {current + 1} / {total}
            </div>

            {/* Controls */}
            {total > 1 && (
              <>
                <Button
                  size="icon"
                  variant="secondary"
                  aria-label="Foto anterior"
                  onClick={() => go(-1)}
                  className="absolute left-2 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full border border-white/10 bg-black/50 text-white opacity-0 backdrop-blur transition hover:bg-black/70 group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  aria-label="Próxima foto"
                  onClick={() => go(1)}
                  className="absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full border border-white/10 bg-black/50 text-white opacity-0 backdrop-blur transition hover:bg-black/70 group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>

                <button
                  type="button"
                  aria-label={paused ? "Retomar autoplay" : "Pausar autoplay"}
                  onClick={() => setPaused((p) => !p)}
                  className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs text-white backdrop-blur transition hover:bg-black/75"
                >
                  {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                  {paused ? "Pausado" : "Auto 30s"}
                </button>
              </>
            )}

            {/* Progress bar */}
            {total > 1 && !paused && (
              <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/10">
                <div
                  key={`progress-${active.id}`}
                  className="h-full bg-primary"
                  style={{ animation: `gallery-progress ${AUTOPLAY_MS}ms linear forwards` }}
                />
              </div>
            )}
          </div>

          {/* Thumbnails rail */}
          {total > 1 && (
            <div className="flex gap-2 overflow-x-auto lg:max-h-[420px] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pr-1">
              {fotos.map((f, i) => {
                const isActive = i === current;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={`Ir para foto ${i + 1}`}
                    aria-current={isActive}
                    className={cn(
                      "relative shrink-0 overflow-hidden rounded-lg ring-1 transition",
                      "h-16 w-24 lg:h-20 lg:w-full",
                      isActive
                        ? "ring-2 ring-primary"
                        : "ring-border/60 opacity-70 hover:opacity-100",
                    )}
                  >
                    <img
                      src={f.foto_url}
                      alt={f.legenda ?? `Foto ${i + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Dots (mobile-friendly) */}
        {total > 1 && (
          <div className="mt-3 flex items-center justify-center gap-1.5 lg:hidden">
            {fotos.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ir para foto ${i + 1}`}
                onClick={() => goTo(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === current
                    ? "w-6 bg-primary"
                    : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
                )}
              />
            ))}
          </div>
        )}
      </CardContent>

      <style>{`
        @keyframes gallery-progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </Card>
  );
}
