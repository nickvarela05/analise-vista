import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileBarChart,
  CalendarRange,
  Calendar,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  Megaphone,
  Users,
  Settings,
  Inbox,
  Briefcase,
  Building2,
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
import { NexusMark } from "@/components/NexusMark";
import { useAuth } from "@/lib/auth-context";
import { cn, iniciais } from "@/lib/utils";

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

// Menu reorganizado em 08/10/2026 pelo uso real (análise de uso, out/2026): a homologação
// em cima, depois o dia a dia, a gestão e os cadastros consultados de vez em quando.
// O grupo Gestão é só para gestor (decisão do Nickolas em 08/10/2026).
const groups: NavGroup[] = [
  {
    label: "Homologação",
    items: [
      { title: "Central", url: "/", icon: ClipboardCheck, tone: "emerald" },
      { title: "Tarefas", url: "/tarefas", icon: CheckSquare, tone: "emerald" },
    ],
  },
  {
    label: "Operação",
    items: [
      { title: "Relatórios", url: "/relatorios", icon: FileBarChart, tone: "amber" },
      { title: "Reuniões", url: "/reunioes", icon: Calendar, tone: "indigo" },
      { title: "Atividades semanais", url: "/atividades", icon: CalendarRange, tone: "sky" },
      { title: "Processos", url: "/processos", icon: CalendarDays, tone: "violet" },
      { title: "Demandas", url: "/demandas", icon: Inbox, tone: "cyan" },
    ],
  },
  {
    label: "Gestão",
    items: [
      {
        title: "Painel da gestão",
        url: "/painel",
        icon: LayoutDashboard,
        tone: "violet",
        requireGestor: true,
      },
      {
        title: "Insights & IA",
        url: "/insights",
        icon: Sparkles,
        tone: "violet",
        requireGestor: true,
      },
      { title: "Avisos", url: "/avisos", icon: Megaphone, tone: "rose", requireGestor: true },
      { title: "Equipe", url: "/equipe", icon: Users, tone: "violet", requireGestor: true },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { title: "Portfólio", url: "/portfolio", icon: Briefcase, tone: "indigo" },
      { title: "Unidades", url: "/unidades", icon: Building2, tone: "emerald" },
    ],
  },
];

const bottomItems: NavItem[] = [
  { title: "Configurações", url: "/configuracoes", icon: Settings, tone: "primary" },
];

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
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader className={cn("py-4", collapsed ? "px-0" : "px-3")}>
        <Link
          to="/"
          className={cn("group flex items-center gap-3", collapsed && "justify-center gap-0")}
        >
          <div
            className={cn(
              "relative flex shrink-0 items-center justify-center rounded-xl bg-primary/12 transition-colors group-hover:bg-primary/20",
              collapsed ? "h-9 w-9" : "h-10 w-10",
            )}
          >
            <NexusMark className={cn("relative", collapsed ? "h-6 w-6" : "h-7 w-7")} />
          </div>

          {!collapsed && (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">
                Nexus
              </span>
              <span className="mt-0.5 text-[11px] text-sidebar-foreground/55">
                Análise de requisitos
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
                <SidebarGroupLabel className="px-3 text-[11px] font-medium text-sidebar-foreground/45">
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
                          className="group/btn relative h-9 rounded-lg transition-all data-[active=true]:bg-transparent"
                        >
                          <Link to={item.url} className="flex items-center gap-2.5">
                            {/* Destaque do item ativo: um só no menu, com nome de transição, para o
                                navegador deslizá-lo do item antigo para o novo (26/10/2026). */}
                            {active && (
                              <span
                                aria-hidden
                                data-vt-menu-ativo
                                className="absolute inset-0 -z-0 rounded-lg bg-sidebar-accent"
                              >
                                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
                              </span>
                            )}
                            <Icon
                              className={cn(
                                "relative h-4 w-4 shrink-0 transition-colors",
                                active
                                  ? "text-primary"
                                  : "text-sidebar-foreground/55 group-hover/btn:text-sidebar-foreground",
                              )}
                            />
                            <span
                              className={cn(
                                "relative truncate text-sm transition-colors",
                                active
                                  ? "font-semibold text-sidebar-foreground"
                                  : "text-sidebar-foreground/75",
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

      <SidebarFooter className="p-2">
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
                        "h-4 w-4 shrink-0 transition-transform duration-300 group-hover/btn:rotate-45",
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
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-sidebar-accent/50 px-2.5 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-[10px] font-semibold uppercase text-primary">
              {iniciais(displayName)}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-xs font-medium text-sidebar-foreground">{displayName}</p>
              <p className="truncate text-[11px] text-sidebar-foreground/55 first-letter:uppercase">
                {role ?? "—"}
              </p>
            </div>
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
              aria-label="online"
            />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
