import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileBarChart,
  CalendarRange,
  Calendar,
  CheckSquare,
  Megaphone,
  Users,
  Settings,
  Inbox,
  Briefcase,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import logoMark from "@/assets/logo-sisteplan-mark.png";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

type Tone = "primary" | "sky" | "emerald" | "violet" | "amber" | "rose" | "indigo" | "cyan";

type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  tone: Tone;
  requireGestor?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const groups: NavGroup[] = [
  {
    label: "Visão",
    items: [
      { title: "Dashboard",     url: "/",         icon: LayoutDashboard, tone: "primary" },
      { title: "Insights & IA", url: "/insights", icon: Sparkles,        tone: "violet"  },
    ],
  },
  {
    label: "Operação",
    items: [
      { title: "Relatórios",          url: "/relatorios", icon: FileBarChart, tone: "amber"   },
      { title: "Atividades semanais", url: "/atividades", icon: CalendarRange,tone: "sky"     },
      { title: "Reuniões",            url: "/reunioes",   icon: Calendar,     tone: "indigo"  },
      { title: "Tarefas",             url: "/tarefas",    icon: CheckSquare,  tone: "emerald" },
      { title: "Demandas",            url: "/demandas",   icon: Inbox,        tone: "cyan"    },
    ],
  },
  {
    label: "Time",
    items: [
      { title: "Avisos",    url: "/avisos",    icon: Megaphone, tone: "rose" },
      { title: "Portfólio", url: "/portfolio", icon: Briefcase, tone: "indigo" },
      { title: "Equipe",    url: "/equipe",    icon: Users,     tone: "violet", requireGestor: true },
    ],
  },
];

const bottomItems: NavItem[] = [
  { title: "Configurações", url: "/configuracoes", icon: Settings, tone: "primary" },
];

const toneIcon: Record<Tone, string> = {
  primary: "text-primary",
  sky:     "text-sky-500 dark:text-sky-400",
  emerald: "text-emerald-500 dark:text-emerald-400",
  violet:  "text-violet-500 dark:text-violet-400",
  amber:   "text-amber-500 dark:text-amber-400",
  rose:    "text-rose-500 dark:text-rose-400",
  indigo:  "text-indigo-500 dark:text-indigo-400",
  cyan:    "text-cyan-500 dark:text-cyan-400",
};

const toneActiveBar: Record<Tone, string> = {
  primary: "bg-primary",
  sky:     "bg-sky-500",
  emerald: "bg-emerald-500",
  violet:  "bg-violet-500",
  amber:   "bg-amber-500",
  rose:    "bg-rose-500",
  indigo:  "bg-indigo-500",
  cyan:    "bg-cyan-500",
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;
  const { role, loading, user } = useAuth();

  const isActive = (path: string) =>
    path === "/" ? currentPath === "/" : currentPath.startsWith(path);

  const filterGestor = (items: NavItem[]) =>
    loading
      ? items.filter((it) => !it.requireGestor)
      : items.filter((it) => !it.requireGestor || role === "gestor");

  const displayName = user?.email?.split("@")[0] ?? "Convidado";

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border bg-gradient-to-b from-sidebar via-sidebar to-sidebar/95"
    >
      <SidebarHeader
        className={cn(
          "border-b border-sidebar-border py-4",
          collapsed ? "px-0" : "px-3",
        )}
      >
        <Link
          to="/"
          className={cn(
            "group flex items-center gap-3",
            collapsed && "justify-center gap-0",
          )}
        >
          <div
            className={cn(
              "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-sidebar/40 ring-1 ring-emerald-500/30 shadow-sm transition-all group-hover:shadow-emerald-500/30 group-hover:shadow-lg",
              collapsed ? "h-9 w-9" : "h-10 w-10",
            )}
          >
            <div className="pointer-events-none absolute -inset-1 bg-gradient-to-tr from-emerald-500/0 via-emerald-500/15 to-teal-400/20 opacity-0 blur-md transition-opacity group-hover:opacity-100" />
            <img
              src={logoMark}
              alt=""
              className={cn(
                "relative object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]",
                collapsed ? "h-6 w-6" : "h-7 w-7",
              )}
            />
          </div>

          {!collapsed && (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="text-sm font-bold uppercase tracking-[0.22em] text-sidebar-foreground">
                Sisteplan
              </span>
              <span className="mt-0.5 flex items-center gap-1 text-[9.5px] uppercase tracking-[0.16em] text-sidebar-foreground/55">
                <Sparkles className="h-2.5 w-2.5 text-emerald-400" />
                Análise de Requisitos
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-1.5 py-2">
        {groups.map((group) => {
          const visible = filterGestor(group.items);
          if (visible.length === 0) return null;
          return (
            <SidebarGroup key={group.label} className="py-1">
              {!collapsed && (
                <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/45">
                  {group.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {visible.map((item) => {
                    const active = isActive(item.url);
                    const Icon = item.icon;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.title}
                          className={cn(
                            "group/btn relative h-9 rounded-lg transition-all",
                            active &&
                              "bg-gradient-to-r from-sidebar-accent via-sidebar-accent/70 to-transparent shadow-sm",
                          )}
                        >
                          <Link to={item.url} className="flex items-center gap-2.5">
                            {/* active accent bar */}
                            <span
                              aria-hidden
                              className={cn(
                                "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full transition-all",
                                active ? toneActiveBar[item.tone] : "bg-transparent",
                              )}
                            />
                            <Icon
                              className={cn(
                                "h-4 w-4 shrink-0 transition-colors",
                                active
                                  ? toneIcon[item.tone]
                                  : "text-sidebar-foreground/60 group-hover/btn:text-sidebar-foreground",
                              )}
                            />
                            <span
                              className={cn(
                                "truncate text-sm transition-colors",
                                active ? "font-semibold text-sidebar-foreground" : "text-sidebar-foreground/80",
                              )}
                            >
                              {item.title}
                            </span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu className="gap-0.5">
          {bottomItems.map((item) => {
            const active = isActive(item.url);
            const Icon = item.icon;
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={item.title}
                  className={cn(
                    "group/btn h-9 rounded-lg transition-all",
                    active && "bg-sidebar-accent",
                  )}
                >
                  <Link to={item.url} className="flex items-center gap-2.5">
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-transform group-hover/btn:rotate-45",
                        active ? "text-primary" : "text-sidebar-foreground/60",
                      )}
                    />
                    <span className="text-sm text-sidebar-foreground/85">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>

        {!collapsed && user && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-sidebar-border/60 bg-sidebar-accent/40 px-2.5 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-violet-500 text-[10px] font-bold uppercase text-primary-foreground">
              {displayName.slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-xs font-medium text-sidebar-foreground">{displayName}</p>
              <p className="truncate text-[10px] uppercase tracking-wider text-sidebar-foreground/55">
                {role ?? "—"}
              </p>
            </div>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" aria-label="online" />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
