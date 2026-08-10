"use client";

import { useEffect, useState, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Watchlist } from "./Watchlist";
import { useChartStore } from "@/lib/store/chart-store";

export function MobileWatchlistDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const activeSymbolKey = useChartStore((s) => s.symbol);
  const prevSymbolRef = useRef(activeSymbolKey);

  // Auto-close drawer when user selects a new coin
  useEffect(() => {
    if (prevSymbolRef.current !== activeSymbolKey) {
      prevSymbolRef.current = activeSymbolKey;
      setIsOpen(false);
    }
  }, [activeSymbolKey]);

  // Touch edge swipe detection (swiping from right 30px edge towards left)
  useEffect(() => {
    let startX = 0;
    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isOpen) return;
      const touch = e.touches[0];
      if (!touch) return;
      const deltaX = startX - touch.clientX;
      const deltaY = Math.abs(touch.clientY - startY);

      // Only open if touch started within 30px of right edge and moved left horizontally
      if (startX >= window.innerWidth - 35 && deltaX > 40 && deltaY < 40) {
        setIsOpen(true);
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [isOpen]);

  return (
    <>
      {/* Floating edge tab handle on the right edge (always visible on mobile < 768px) */}
      <div className="md:hidden">
        <button
          type="button"
          aria-label="Abrir lista de monedas"
          onClick={() => setIsOpen(!isOpen)}
          className="fixed right-0 top-[45%] -translate-y-1/2 z-40 flex h-14 w-8 items-center justify-center rounded-l-xl border-y border-l border-[#22D9FF]/50 bg-[#071426] text-[#22D9FF] shadow-[0_0_12px_rgba(34,217,255,0.25)] transition-all duration-200 active:scale-95"
        >
          <div className="flex items-center justify-center">
            {isOpen ? (
              <ChevronRight className="h-5 w-5 text-tv-blue animate-pulse" />
            ) : (
              <ChevronLeft className="h-5 w-5 text-[#22D9FF] animate-pulse" />
            )}
          </div>
        </button>
      </div>

      {/* Backdrop overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden transition-opacity duration-250"
        />
      )}

      {/* Mobile Right Drawer */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-[85vw] max-w-[360px] flex-col border-l border-tv-border bg-tv-panel shadow-2xl transition-transform duration-250 ease-out md:hidden ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="flex h-11 items-center justify-between border-b border-tv-border bg-tv-bg px-3">
          <span className="text-xs font-bold uppercase tracking-wider text-tv-text flex items-center gap-1.5">
            <span className="text-tv-blue">⚡</span> Lista de Monedas
          </span>
          <button
            onClick={() => setIsOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-tv-panel-hover text-tv-text-muted hover:text-tv-text cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Drawer Watchlist Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <Watchlist />
        </div>
      </div>
    </>
  );
}
