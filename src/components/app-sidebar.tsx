import { NavLink, useLocation } from "react-router-dom";
import { Users, Map, Settings, LayoutDashboard, List, Gauge, Shield, CreditCard, PlayCircle, HardHat, GraduationCap, ShieldCheck, HardDrive, Activity, Sliders, CheckSquare } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/app/dashboard", icon: LayoutDashboard },
  { title: "Eventos", url: "/app/events", icon: List },
  { title: "DVR/Streams", url: "/test-dvr", icon: HardDrive },
  { title: "Antitheft", url: "/app/antitheft", icon: Shield },
  { title: "SafetyVision", url: "/app/safety", icon: HardHat },
  { title: "EduBehavior", url: "/app/edubehavior", icon: GraduationCap },
  { title: "Privacidade", url: "/app/privacy", icon: ShieldCheck },
  { title: "Saúde & Alertas", url: "/app/health", icon: Activity },
  { title: "Parâmetros IA", url: "/app/parameters", icon: Sliders },
  { title: "Deploy Checklist", url: "/app/deployment", icon: CheckSquare },
  { title: "Créditos", url: "/app/credits", icon: CreditCard },
  { title: "Demonstração", url: "/app/demo", icon: PlayCircle },
  { title: "Pessoas", url: "/app/people", icon: Users },
  { title: "Config", url: "/app/config", icon: Settings },
  { title: "Métricas", url: "/app/metrics", icon: Gauge },
  { title: "Mapa", url: "/app/map", icon: Map },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-muted text-primary font-medium" : "hover:bg-muted/50";

  return (
    <Sidebar collapsible="icon">
      <SidebarTrigger className="m-2 self-end" />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Visão de Águia</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="mr-2 h-4 w-4" />
                      <span className="truncate">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
