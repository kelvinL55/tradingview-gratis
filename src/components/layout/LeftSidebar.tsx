"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  MousePointer2,
  Minus,
  Ruler,
  Trash2,
  Lock,
  Brush,
  Highlighter,
  ArrowUpRight,
  ArrowRight,
  ChevronUp,
  ChevronDown,
  Square,
  RotateCw,
  GitBranch,
  Circle,
  Egg,
  TrendingUp,
  Waves,
  Triangle,
  HelpCircle,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useChartStore, type DrawingTool } from "@/lib/store/chart-store";
import { cn } from "@/lib/utils";

interface ToolDef {
  key: DrawingTool;
  icon: typeof MousePointer2;
  label: string;
  hint?: string;
}

const TOOLS: ToolDef[] = [
  { key: "cursor", icon: MousePointer2, label: "Cursor", hint: "Modo navegación" },
  {
    key: "hline",
    icon: Minus,
    label: "Línea horizontal",
    hint: "Click en el chart para marcar un precio",
  },
  {
    key: "measure",
    icon: Ruler,
    label: "Regla / Medir",
    hint: "Click en dos puntos para medir Δ precio, %, barras y volumen",
  },
];

const LOCKED = [
  { label: "Línea de tendencia" },
  { label: "Fibonacci" },
  { label: "Texto" },
];

export function LeftSidebar() {
  const tool = useChartStore((s) => s.tool);
  const setTool = useChartStore((s) => s.setTool);
  const clearPriceLines = useChartStore((s) => s.clearPriceLines);
  const symbol = useChartStore((s) => s.symbol);

  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedSubTool, setSelectedSubTool] = useState<string>("Pincel");
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const selectSubToolHandler = (name: string) => {
    setSelectedSubTool(name);
    setMenuOpen(false);
    // Habilitar simulación de herramienta
    setTool("cursor");
  };

  const getSubToolIcon = () => {
    switch (selectedSubTool) {
      case "Resaltador":
        return <Highlighter className="h-4 w-4" />;
      case "Marcador de flecha":
      case "Flecha":
        return <ArrowRight className="h-4 w-4" />;
      case "Marca de flecha hacia arriba":
        return <ChevronUp className="h-4 w-4" />;
      case "Marca de flecha hacia abajo":
        return <ChevronDown className="h-4 w-4" />;
      case "Rectángulo":
      case "Rectángulo rotado":
        return <Square className="h-4 w-4" />;
      case "Círculo":
      case "Elipse":
        return <Circle className="h-4 w-4" />;
      case "Curva":
      case "Doble curva":
      case "Arco":
        return <TrendingUp className="h-4 w-4" />;
      case "Triángulo":
        return <Triangle className="h-4 w-4" />;
      default:
        return <Brush className="h-4 w-4" />;
    }
  };

  return (
    <aside className="relative hidden md:flex w-11 flex-col items-center gap-0.5 border-r border-tv-border bg-tv-panel py-1.5 z-30">
      {/* Cursor */}
      <Tooltip>
        <TooltipTrigger
          onClick={() => setTool("cursor")}
          aria-label="Cursor"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-tv-panel-hover",
            tool === "cursor" && !menuOpen
              ? "bg-tv-blue/15 text-tv-blue"
              : "text-tv-text-muted hover:text-tv-text"
          )}
        >
          <MousePointer2 className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          <div className="font-medium">Cursor</div>
          <div className="mt-0.5 text-[10px] text-tv-text-muted">Modo navegación</div>
        </TooltipContent>
      </Tooltip>

      {/* Pincel / Selector de herramientas dinámicas */}
      <Tooltip>
        <TooltipTrigger
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Pinceles y Figuras"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-tv-panel-hover relative",
            menuOpen
              ? "bg-tv-blue text-white"
              : "text-tv-text-muted hover:text-tv-text"
          )}
        >
          {getSubToolIcon()}
          <span className="absolute bottom-0 right-0 h-1 w-1 bg-tv-text-dim rounded-full" />
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          <div className="font-medium">Herramientas de dibujo</div>
          <div className="mt-0.5 text-[10px] text-tv-text-muted">
            Herramienta activa: {selectedSubTool}
          </div>
        </TooltipContent>
      </Tooltip>

      {/* Línea horizontal */}
      <Tooltip>
        <TooltipTrigger
          onClick={() => setTool("hline")}
          aria-label="Línea horizontal"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-tv-panel-hover",
            tool === "hline"
              ? "bg-tv-blue/15 text-tv-blue"
              : "text-tv-text-muted hover:text-tv-text"
          )}
        >
          <Minus className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          <div className="font-medium">Línea horizontal</div>
          <div className="mt-0.5 text-[10px] text-tv-text-muted">
            Click en el chart para marcar un precio
          </div>
        </TooltipContent>
      </Tooltip>

      {/* Regla / Medir */}
      <Tooltip>
        <TooltipTrigger
          onClick={() => setTool("measure")}
          aria-label="Regla / Medir"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-tv-panel-hover",
            tool === "measure"
              ? "bg-tv-blue/15 text-tv-blue"
              : "text-tv-text-muted hover:text-tv-text"
          )}
        >
          <Ruler className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          <div className="font-medium">Regla / Medir</div>
          <div className="mt-0.5 text-[10px] text-tv-text-muted">
            Click en dos puntos para medir Δ precio, %, barras y volumen
          </div>
        </TooltipContent>
      </Tooltip>

      {/* Borrar dibujos */}
      <Tooltip>
        <TooltipTrigger
          onClick={() => clearPriceLines(symbol)}
          aria-label="Borrar dibujos"
          className="flex h-8 w-8 items-center justify-center rounded text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-red"
        >
          <Trash2 className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          <div className="font-medium">Borrar dibujos</div>
          <div className="mt-0.5 text-[10px] text-tv-text-muted">
            Limpia las líneas de este símbolo
          </div>
        </TooltipContent>
      </Tooltip>

      <div className="my-1 h-px w-6 bg-tv-border" />

      {/* Candados próximamente */}
      {LOCKED.map((t) => (
        <Tooltip key={t.label}>
          <TooltipTrigger
            disabled
            aria-label={t.label}
            className="flex h-8 w-8 cursor-not-allowed items-center justify-center rounded text-tv-text-dim opacity-40"
          >
            <Lock className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            <div className="font-medium">{t.label}</div>
            <div className="mt-0.5 text-[10px] text-tv-yellow">
              Próximamente · video 3
            </div>
          </TooltipContent>
        </Tooltip>
      ))}

      {/* Dropdown Menu Flotante (TradingView Style) */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute left-12 top-2 w-[220px] rounded bg-tv-panel border border-tv-border shadow-xl backdrop-blur-md text-[11px] text-tv-text pointer-events-auto flex flex-col z-50 animate-in fade-in slide-in-from-left-2 duration-100 py-1"
        >
          {/* PINCELES */}
          <div className="px-3 py-1 text-[10px] font-bold text-tv-text-dim border-b border-tv-border/20 tracking-wider">
            PINCELES
          </div>
          <button
            onClick={() => selectSubToolHandler("Pincel")}
            className={cn(
              "flex items-center justify-between px-3 py-1.5 text-left hover:bg-tv-panel-hover w-full transition-colors",
              selectedSubTool === "Pincel" && "bg-tv-blue/10 text-tv-blue"
            )}
          >
            <span className="flex items-center gap-2">
              <Brush className="h-3.5 w-3.5" />
              <span>Pincel</span>
            </span>
          </button>
          <button
            onClick={() => selectSubToolHandler("Resaltador")}
            className={cn(
              "flex items-center justify-between px-3 py-1.5 text-left hover:bg-tv-panel-hover w-full transition-colors border-b border-tv-border/20 pb-2",
              selectedSubTool === "Resaltador" && "bg-tv-blue/10 text-tv-blue"
            )}
          >
            <span className="flex items-center gap-2">
              <Highlighter className="h-3.5 w-3.5" />
              <span>Resaltador</span>
            </span>
          </button>

          {/* FLECHAS */}
          <div className="px-3 py-1 text-[10px] font-bold text-tv-text-dim border-b border-tv-border/20 mt-1 tracking-wider">
            FLECHAS
          </div>
          <button
            onClick={() => selectSubToolHandler("Marcador de flecha")}
            className={cn(
              "flex items-center justify-between px-3 py-1.5 text-left hover:bg-tv-panel-hover w-full transition-colors",
              selectedSubTool === "Marcador de flecha" && "bg-tv-blue/10 text-tv-blue"
            )}
          >
            <span className="flex items-center gap-2">
              <ArrowRight className="h-3.5 w-3.5" />
              <span>Marcador de flecha</span>
            </span>
          </button>
          <button
            onClick={() => selectSubToolHandler("Flecha")}
            className={cn(
              "flex items-center justify-between px-3 py-1.5 text-left hover:bg-tv-panel-hover w-full transition-colors",
              selectedSubTool === "Flecha" && "bg-tv-blue/10 text-tv-blue"
            )}
          >
            <span className="flex items-center gap-2">
              <ArrowRight className="h-3.5 w-3.5" />
              <span>Flecha</span>
            </span>
          </button>
          <button
            onClick={() => selectSubToolHandler("Marca de flecha hacia arriba")}
            className={cn(
              "flex items-center justify-between px-3 py-1.5 text-left hover:bg-tv-panel-hover w-full transition-colors",
              selectedSubTool === "Marca de flecha hacia arriba" && "bg-tv-blue/10 text-tv-blue"
            )}
          >
            <span className="flex items-center gap-2">
              <ChevronUp className="h-3.5 w-3.5" />
              <span>Marca de flecha hacia arriba</span>
            </span>
          </button>
          <button
            onClick={() => selectSubToolHandler("Marca de flecha hacia abajo")}
            className={cn(
              "flex items-center justify-between px-3 py-1.5 text-left hover:bg-tv-panel-hover w-full transition-colors border-b border-tv-border/20 pb-2",
              selectedSubTool === "Marca de flecha hacia abajo" && "bg-tv-blue/10 text-tv-blue"
            )}
          >
            <span className="flex items-center gap-2">
              <ChevronDown className="h-3.5 w-3.5" />
              <span>Marca de flecha hacia abajo</span>
            </span>
          </button>

          {/* FIGURAS */}
          <div className="px-3 py-1 text-[10px] font-bold text-tv-text-dim border-b border-tv-border/20 mt-1 tracking-wider">
            FIGURAS
          </div>
          <button
            onClick={() => selectSubToolHandler("Rectángulo")}
            className={cn(
              "flex items-center justify-between px-3 py-1.5 text-left hover:bg-tv-panel-hover w-full transition-colors",
              selectedSubTool === "Rectángulo" && "bg-tv-blue/10 text-tv-blue"
            )}
          >
            <span className="flex items-center gap-2">
              <Square className="h-3.5 w-3.5" />
              <span>Rectángulo</span>
            </span>
          </button>
          <button
            onClick={() => selectSubToolHandler("Rectángulo rotado")}
            className={cn(
              "flex items-center justify-between px-3 py-1.5 text-left hover:bg-tv-panel-hover w-full transition-colors",
              selectedSubTool === "Rectángulo rotado" && "bg-tv-blue/10 text-tv-blue"
            )}
          >
            <span className="flex items-center gap-2">
              <RotateCw className="h-3.5 w-3.5" />
              <span>Rectángulo rotado</span>
            </span>
          </button>
          <button
            onClick={() => selectSubToolHandler("Ruta")}
            className={cn(
              "flex items-center justify-between px-3 py-1.5 text-left hover:bg-tv-panel-hover w-full transition-colors",
              selectedSubTool === "Ruta" && "bg-tv-blue/10 text-tv-blue"
            )}
          >
            <span className="flex items-center gap-2">
              <GitBranch className="h-3.5 w-3.5" />
              <span>Ruta</span>
            </span>
          </button>
          <button
            onClick={() => selectSubToolHandler("Círculo")}
            className={cn(
              "flex items-center justify-between px-3 py-1.5 text-left hover:bg-tv-panel-hover w-full transition-colors",
              selectedSubTool === "Círculo" && "bg-tv-blue/10 text-tv-blue"
            )}
          >
            <span className="flex items-center gap-2">
              <Circle className="h-3.5 w-3.5" />
              <span>Círculo</span>
            </span>
          </button>
          <button
            onClick={() => selectSubToolHandler("Elipse")}
            className={cn(
              "flex items-center justify-between px-3 py-1.5 text-left hover:bg-tv-panel-hover w-full transition-colors",
              selectedSubTool === "Elipse" && "bg-tv-blue/10 text-tv-blue"
            )}
          >
            <span className="flex items-center gap-2">
              <Egg className="h-3.5 w-3.5" />
              <span>Elipse</span>
            </span>
          </button>
          <button
            onClick={() => selectSubToolHandler("Triángulo")}
            className={cn(
              "flex items-center justify-between px-3 py-1.5 text-left hover:bg-tv-panel-hover w-full transition-colors",
              selectedSubTool === "Triángulo" && "bg-tv-blue/10 text-tv-blue"
            )}
          >
            <span className="flex items-center gap-2">
              <Triangle className="h-3.5 w-3.5" />
              <span>Triángulo</span>
            </span>
          </button>
          <button
            onClick={() => selectSubToolHandler("Curva")}
            className={cn(
              "flex items-center justify-between px-3 py-1.5 text-left hover:bg-tv-panel-hover w-full transition-colors",
              selectedSubTool === "Curva" && "bg-tv-blue/10 text-tv-blue"
            )}
          >
            <span className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Curva</span>
            </span>
          </button>
          <button
            onClick={() => selectSubToolHandler("Doble curva")}
            className={cn(
              "flex items-center justify-between px-3 py-1.5 text-left hover:bg-tv-panel-hover w-full transition-colors border-b border-tv-border/20 pb-1.5",
              selectedSubTool === "Doble curva" && "bg-tv-blue/10 text-tv-blue"
            )}
          >
            <span className="flex items-center gap-2">
              <Waves className="h-3.5 w-3.5" />
              <span>Doble curva</span>
            </span>
          </button>
        </div>
      )}
    </aside>
  );
}
