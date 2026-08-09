"use client";

import { Layout, Save, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChartStore } from "@/lib/store/chart-store";

export function ProfileSelector() {
  const profiles = useChartStore((s) => s.profiles);
  const activeProfileId = useChartStore((s) => s.activeProfileId);
  const saveProfile = useChartStore((s) => s.saveProfile);
  const loadProfile = useChartStore((s) => s.loadProfile);

  const profileKeys = ["1", "2", "3", "4"] as const;

  const activeProfile = (activeProfileId && profiles) ? profiles[activeProfileId] : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs text-tv-text hover:bg-tv-panel-hover outline-none transition-colors">
        <Layout className="h-3.5 w-3.5" />
        <span>{activeProfileId ? `Perfil ${activeProfileId}` : "Perfiles"}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 bg-tv-panel border-tv-border text-tv-text">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-tv-text-muted px-2 py-1.5">
            Cargar Perfil
          </DropdownMenuLabel>
          {profileKeys.map((key) => {
            const profile = profiles?.[key];
            const isActive = activeProfileId === key;
            return (
              <DropdownMenuItem
                key={`load-${key}`}
                disabled={!profile}
                onClick={() => loadProfile(key)}
                className="flex items-center justify-between text-xs cursor-pointer hover:bg-tv-panel-hover focus:bg-tv-panel-hover px-2 py-1.5"
              >
                <div className="flex flex-col items-start">
                  <span className={isActive ? "font-semibold text-tv-blue" : ""}>
                    Perfil {key}
                  </span>
                  <span className="text-[9px] text-tv-text-muted">
                    {profile ? `${profile.symbol} · ${profile.timeframe}` : "Vacío"}
                  </span>
                </div>
                {isActive && <Check className="h-3.5 w-3.5 text-tv-blue" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="bg-tv-border" />

        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-tv-text-muted px-2 py-1.5">
            Guardar Estrategia Actual
          </DropdownMenuLabel>
          {profileKeys.map((key) => {
            return (
              <DropdownMenuItem
                key={`save-${key}`}
                onClick={() => saveProfile(key)}
                className="flex items-center justify-between text-xs cursor-pointer hover:bg-tv-panel-hover focus:bg-tv-panel-hover px-2 py-1.5"
              >
                <span>Guardar en Perfil {key}</span>
                <Save className="h-3 w-3 text-tv-text-muted" />
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
