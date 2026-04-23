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
import logoUrl from "@/assets/logo.png";
import { useAuth } from "@/lib/auth-context";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Relatórios", url: "/relatorios", icon: FileBarChart },
  { title: "Atividades semanais", url: "/atividades", icon: CalendarRange },
  { title: "Reuniões", url: "/reunioes", icon: Calendar },
  { title: "Tarefas", url: "/tarefas", icon: CheckSquare },
  { title: "Demandas", url: "/demandas", icon: Inbox },
  { title: "Avisos", url: "/avisos", icon: Megaphone },
  { title: "Equipe", url: "/equipe", icon: Users, requireGestor: true },
] as const;

const bottomItems = [{ title: "Configurações", url: "/configuracoes", icon: Settings }];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;
  const { role } = useAuth();

  const isActive = (path: string) =>
    path === "/" ? currentPath === "/" : currentPath.startsWith(path);

  const visibleItems = items.filter(
    (it) => !("requireGestor" in it && it.requireGestor) || role === "gestor",
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sidebar-primary/10 ring-1 ring-sidebar-primary/20">
            <img src={logoUrl} alt="" className="h-7 w-7 object-contain" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-wide text-sidebar-foreground">
                SISTEPLAN
              </span>
              <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
                Análise de Requisitos
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          {bottomItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                <Link to={item.url}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
