import { adxDmi } from "./index";
import { macd } from "./index";
import { rci } from "./rci";
import type { Candle } from "@/lib/binance/types";

// Generar 100 velas mock con movimiento sinodal
const mockCandles: Candle[] = [];
let basePrice = 100;
const now = Math.floor(Date.now() / 1000);
for (let i = 0; i < 100; i++) {
  const change = Math.sin(i / 5) * 5 + 0.5;
  const open = basePrice;
  const close = basePrice + change;
  const high = Math.max(open, close) + 2;
  const low = Math.min(open, close) - 2;
  mockCandles.push({
    time: now + i * 900, // Intervalos de 15m
    open,
    high,
    low,
    close,
    volume: 1000 + (i % 10) * 100,
  });
  basePrice = close;
}

console.log("=== EJECUTANDO PRUEBAS UNITARIAS DE INDICADORES ===");

// 1. Validar MACD
console.log("\nProcesando MACD (12, 26, 9)...");
const macdResult = macd(mockCandles, 12, 26, 9);
console.log(`MACD calculado. Puntos resultantes: ${macdResult.length}`);
if (macdResult.length > 0) {
  const lastPoint = macdResult[macdResult.length - 1];
  console.log(`Último punto MACD -> MACD: ${lastPoint.macd.toFixed(4)}, Signal: ${lastPoint.signal.toFixed(4)}, Histograma: ${lastPoint.histogram.toFixed(4)}`);
  if (isNaN(lastPoint.macd) || isNaN(lastPoint.signal) || isNaN(lastPoint.histogram)) {
    console.error("❌ ERROR: El cálculo de MACD contiene valores NaN");
    process.exit(1);
  } else {
    console.log("✅ MACD validado con éxito");
  }
} else {
  console.error("❌ ERROR: El cálculo de MACD no devolvió datos");
  process.exit(1);
}

// 2. Validar ADX / DMI
console.log("\nProcesando ADX/DMI (14, 14)...");
const adxResult = adxDmi(mockCandles, 14, 14);
console.log(`ADX/DMI calculado. Puntos resultantes: ${adxResult.length}`);
if (adxResult.length > 0) {
  const lastPoint = adxResult[adxResult.length - 1];
  console.log(`Último punto ADX/DMI -> ADX: ${lastPoint.adx.toFixed(4)}, +DI: ${lastPoint.plusDI.toFixed(4)}, -DI: ${lastPoint.minusDI.toFixed(4)}`);
  if (isNaN(lastPoint.adx) || isNaN(lastPoint.plusDI) || isNaN(lastPoint.minusDI)) {
    console.error("❌ ERROR: El cálculo de ADX contiene valores NaN");
    process.exit(1);
  } else {
    console.log("✅ ADX/DMI validado con éxito");
  }
} else {
  console.error("❌ ERROR: El cálculo de ADX no devolvió datos");
  process.exit(1);
}

// 3. Validar RCI
console.log("\nProcesando RCI (9)...");
const rciResult = rci(mockCandles, 9);
console.log(`RCI calculado. Puntos resultantes: ${rciResult.length}`);
if (rciResult.length > 0) {
  const lastPoint = rciResult[rciResult.length - 1];
  console.log(`Último punto RCI -> Valor: ${lastPoint.value.toFixed(4)}`);
  if (isNaN(lastPoint.value)) {
    console.error("❌ ERROR: El cálculo de RCI contiene valores NaN");
    process.exit(1);
  } else if (lastPoint.value < -101 || lastPoint.value > 101) {
    console.error(`❌ ERROR: El RCI está fuera del rango permitido (-100, 100): ${lastPoint.value}`);
    process.exit(1);
  } else {
    console.log("✅ RCI validado con éxito");
  }
} else {
  console.error("❌ ERROR: El cálculo de RCI no devolvió datos");
  process.exit(1);
}

console.log("\n🎉 ¡TODAS LAS PRUEBAS DE INDICADORES PASARON CORRECTAMENTE!");
