"use client";
import React from "react";
import { Eye, EyeOff, Settings, X, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  name: string;
  value?: React.ReactNode;
  color: string;
  hidden: boolean;
  onToggleHide: () => void;
  onSettings: () => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  order?: number;
  onChangeOrder?: (order: number) => void;
}

export function IndicatorPill({
  name,
  value,
  color,
  hidden,
  onToggleHide,
  onSettings,
  onRemove,
  onMoveUp,
  onMoveDown,
  order,
  onChangeOrder,
}: Props) {
  return (
    <div
      className={cn(
        "group/pill pointer-events-auto flex items-center gap-1.5 rounded bg-tv-panel/95 px-1.5 py-0.5 text-[11px] shadow-sm ring-1 ring-tv-border backdrop-blur",
        hidden && "opacity-50",
      )}
    >
      {onChangeOrder !== undefined && order !== undefined && (
        <select
          value={order}
          onChange={(e) => onChangeOrder(parseInt(e.target.value))}
          title="Número de panel/orden (indicadores con el mismo número se unirán)"
          className="bg-tv-bg text-tv-text text-[10px] font-bold border border-tv-border/60 rounded px-0.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-tv-blue cursor-pointer pointer-events-auto mr-0.5 h-[18px] w-6 text-center appearance-none flex items-center justify-center hover:bg-tv-panel-hover"
        >
          {[1, 2, 3, 4, 5].map((num) => (
            <option key={num} value={num}>
              {num}
            </option>
          ))}
        </select>
      )}
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: color }}
      />
      <span className="font-medium text-tv-text">{name}</span>
      {value !== undefined && (
        <span className="tabular-nums text-tv-text-muted">{value}</span>
      )}
      <div className="ml-1 flex items-center gap-0.5">
        {onMoveUp && (
          <button
            onClick={onMoveUp}
            title="Subir panel (sobreponer)"
            aria-label="Subir panel"
            className="rounded p-0.5 text-tv-text-dim transition-colors hover:bg-tv-panel-hover hover:text-tv-text"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
        )}
        {onMoveDown && (
          <button
            onClick={onMoveDown}
            title="Bajar panel"
            aria-label="Bajar panel"
            className="rounded p-0.5 text-tv-text-dim transition-colors hover:bg-tv-panel-hover hover:text-tv-text"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={onToggleHide}
          title={hidden ? "Mostrar" : "Ocultar"}
          aria-label={hidden ? "Mostrar" : "Ocultar"}
          className="rounded p-0.5 text-tv-text-dim transition-colors hover:bg-tv-panel-hover hover:text-tv-text"
        >
          {hidden ? (
            <EyeOff className="h-3 w-3" />
          ) : (
            <Eye className="h-3 w-3" />
          )}
        </button>
        <button
          onClick={onSettings}
          title="Configurar"
          aria-label="Configurar"
          className="rounded p-0.5 text-tv-text-dim transition-colors hover:bg-tv-panel-hover hover:text-tv-text"
        >
          <Settings className="h-3 w-3" />
        </button>
        <button
          onClick={onRemove}
          title="Eliminar"
          aria-label="Eliminar"
          className="rounded p-0.5 text-tv-text-dim transition-colors hover:bg-tv-panel-hover hover:text-tv-red"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
