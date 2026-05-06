import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Images, Loader2 } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Foto {
  id: string;
  foto_url: string;
  legenda: string | null;
  ordem: number;
}

export function GaleriaCarousel() {
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);

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

  React.useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    api.on("select", () => setCurrent(api.selectedScrollSnap()));
  }, [api]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex h-48 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!fotos || fotos.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
          <Images className="h-8 w-8 opacity-50" />
          Nenhuma foto na galeria ainda.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <Carousel setApi={setApi} opts={{ loop: fotos.length > 1 }} className="w-full">
          <CarouselContent>
            {fotos.map((f) => (
              <CarouselItem key={f.id}>
                <div className="relative overflow-hidden rounded-md bg-muted">
                  <img
                    src={f.foto_url}
                    alt={f.legenda ?? "Foto da equipe"}
                    className="h-[420px] w-full object-cover"
                  />
                  {f.legenda && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                      <p className="text-sm text-white">{f.legenda}</p>
                    </div>
                  )}
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {fotos.length > 1 && (
            <>
              <CarouselPrevious className="left-2" />
              <CarouselNext className="right-2" />
            </>
          )}
        </Carousel>

        {fotos.length > 1 && (
          <div className="mt-3 flex items-center justify-center gap-1.5">
            {fotos.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ir para foto ${i + 1}`}
                onClick={() => api?.scrollTo(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === current ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
                )}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
