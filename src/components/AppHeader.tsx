import * as React from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { Search, Moon, Sun, LogOut, User as UserIcon, Sparkles, ChevronRight } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/avisos/NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/lib/theme-provider";
import { useAuth } from "@/lib/auth-context";
import { GlobalSearch, useGlobalSearchHotkey } from "@/components/GlobalSearch";
import { cn } from "@/lib/utils";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/insights": "Insights & IA",
  "/relatorios": "Relatórios",
  "/atividades": "Atividades semanais",
  "/reunioes": "Reuniões",
  "/tarefas": "Tarefas",
  "/demandas": "Demandas",
  "/avisos": "Avisos",
  "/portfolio": "Portfólio",
  "/unidades": "Unidades",
  "/equipe": "Equipe",
  "/configuracoes": "Configurações",
  "/perfil": "Meu perfil",
};

function currentLabel(pathname: string) {
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname];
  const base = "/" + pathname.split("/").filter(Boolean)[0];
  return ROUTE_LABELS[base] ?? "—";
}

export function AppHeader() {
  const { theme, toggle } = useTheme();
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = React.useState(false);
  useGlobalSearchHotkey(setSearchOpen);

  const displayName = user?.email?.split("@")[0] ?? "Convidado";
  const initials = (user?.email ?? "DV").split("@")[0].slice(0, 2).toUpperCase();
  const pageLabel = currentLabel(location.pathname);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/70 px-3 sm:gap-3 sm:px-4",
        "bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/55",
      )}
    >
      {/* subtle gradient accent */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <SidebarTrigger className="hover:bg-accent" />

      {/* Breadcrumb-ish current page */}
      <div className="hidden items-center gap-1.5 text-sm md:flex">
        <Sparkles className="h-3.5 w-3.5 text-primary/70" />
        <span className="text-muted-foreground">Sisteplan</span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
        <span className="font-semibold text-foreground">{pageLabel}</span>
      </div>

      {/* Search */}
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className={cn(
          "group relative ml-auto hidden h-9 w-full max-w-sm items-center gap-2 overflow-hidden rounded-full",
          "border border-border/70 bg-card/60 px-3.5 text-sm text-muted-foreground",
          "transition-all hover:border-primary/40 hover:bg-card hover:shadow-sm hover:shadow-primary/5",
          "md:flex",
        )}
      >
        <Search className="h-3.5 w-3.5 transition-colors group-hover:text-primary" />
        <span className="truncate">Buscar demandas, tarefas, reuniões…</span>
        <kbd className="ml-auto hidden rounded border border-border/80 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground lg:inline-block">
          ⌘ K
        </kbd>
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="ml-auto md:hidden"
        onClick={() => setSearchOpen(true)}
        aria-label="Buscar"
      >
        <Search className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-1">
        <NotificationBell />

        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label="Alternar tema"
          className="relative overflow-hidden"
        >
          <Sun
            className={cn(
              "h-4 w-4 transition-all duration-300",
              theme === "dark" ? "rotate-0 scale-100" : "-rotate-90 scale-0",
            )}
          />
          <Moon
            className={cn(
              "absolute h-4 w-4 transition-all duration-300",
              theme === "dark" ? "rotate-90 scale-0" : "rotate-0 scale-100",
            )}
          />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="ml-1 h-9 gap-2 rounded-full border border-transparent px-1.5 transition-all hover:border-border hover:bg-card hover:pl-1.5 hover:pr-3"
            >
              <div className="relative">
                <Avatar className="h-7 w-7 ring-2 ring-primary/20">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-violet-500 text-[11px] font-bold text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background" />
              </div>
              <div className="hidden flex-col items-start leading-tight md:flex">
                <span className="text-xs font-medium text-foreground">{displayName}</span>
                <Badge
                  variant="outline"
                  className="h-3.5 border-primary/30 bg-primary/5 px-1 text-[9px] uppercase text-primary"
                >
                  {user ? (role ?? "—") : "dev"}
                </Badge>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-violet-500 text-xs font-bold text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-sm font-semibold">{user?.email ?? "Conta"}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {user ? (role ?? "carregando") : "não autenticado"}
                  </p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: "/perfil" })} className="gap-2">
              <UserIcon className="h-4 w-4" /> Meu perfil
            </DropdownMenuItem>
            {user && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="gap-2 text-rose-600 focus:text-rose-600">
                  <LogOut className="h-4 w-4" /> Sair
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
