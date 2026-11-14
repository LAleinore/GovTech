import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Flame,
  Radio,
  ShieldAlert,
  Wifi,
  WifiOff,
  Wind,
} from "lucide-react";

export type SimulationScenario =
  | "NORMAL"
  | "SMOKE"
  | "TEMP_WARNING"
  | "FIRE_ALARM"
  | "DEVICE_OFFLINE";

interface SimulationControlBarProps {
  currentScenario?: SimulationScenario;
  wsConnected: boolean;
  onTriggerScenario: (scenario: SimulationScenario) => Promise<void>;
  loading?: boolean;
}

export const SimulationControlBar: React.FC<SimulationControlBarProps> = ({
  currentScenario = "NORMAL",
  wsConnected,
  onTriggerScenario,
  loading = false,
}) => {
  const [activeScenario, setActiveScenario] = useState<SimulationScenario>(currentScenario);
  const [pendingScenario, setPendingScenario] = useState<SimulationScenario | null>(null);

  const handleSelect = async (scenario: SimulationScenario) => {
    setPendingScenario(scenario);
    try {
      await onTriggerScenario(scenario);
      setActiveScenario(scenario);
    } finally {
      setPendingScenario(null);
    }
  };

  return (
    <div className="border border-[#DCDAD4] bg-white p-4 sm:p-5 shadow-sm space-y-3">
      {/* Top Header: Badge, Disclaimer & WS indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCDAD4] pb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 border border-[#3E506E]/40 bg-[#E8EEF5] text-[#2A3952] font-mono text-[11px] font-semibold tracking-wider uppercase">
            <span className="w-1.5 h-1.5 bg-[#3E506E] animate-pulse" />
            <span>DEMO MODE // СИМУЛЯЦИЯ ПОЖАРА</span>
          </div>

          <span className="hidden md:inline font-mono text-[10px] text-[#8E8C84]">
            СЕРВЕРНЫЙ ЭМУЛЯТОР УГРОЗ
          </span>
        </div>

        {/* WebSocket Connection Status Badge */}
        <div className="flex items-center gap-2 font-mono text-[11px]">
          {wsConnected ? (
            <span className="inline-flex items-center gap-1.5 text-[#146330] bg-[#E9F5EE] border border-[#1F8844]/30 px-2 py-0.5">
              <Wifi className="w-3.5 h-3.5 text-[#1F8844]" />
              <span>ШИНА WS АКТИВНА</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[#5C5B56] bg-[#F5F4F0] border border-[#DCDAD4] px-2 py-0.5">
              <WifiOff className="w-3.5 h-3.5 text-[#8E8C84]" />
              <span>РЕЖИМ ОПРОСА (REST)</span>
            </span>
          )}
        </div>
      </div>

      {/* Scenario Buttons Grid */}
      <div className="flex flex-wrap items-center gap-2">
        {/* 1. Normal Operation */}
        <button
          type="button"
          disabled={loading || pendingScenario !== null}
          onClick={() => handleSelect("NORMAL")}
          className={`px-3 py-2 border text-xs font-mono font-medium transition-colors flex items-center gap-2 ${
            activeScenario === "NORMAL"
              ? "bg-[#1F8844] text-white border-[#1F8844]"
              : "bg-[#F5F4F0] hover:bg-[#EBEAE5] text-[#181816] border-[#DCDAD4]"
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>ШТАТНЫЙ РЕЖИМ</span>
        </button>

        {/* 2. Smoke Detection */}
        <button
          type="button"
          disabled={loading || pendingScenario !== null}
          onClick={() => handleSelect("SMOKE")}
          className={`px-3 py-2 border text-xs font-mono font-medium transition-colors flex items-center gap-2 ${
            activeScenario === "SMOKE"
              ? "bg-[#D9822B] text-white border-[#D9822B]"
              : "bg-[#F5F4F0] hover:bg-[#EBEAE5] text-[#181816] border-[#DCDAD4]"
          }`}
        >
          <Wind className="w-3.5 h-3.5" />
          <span>ОБНАРУЖЕНИЕ ДЫМА</span>
        </button>

        {/* 3. Temperature Warning */}
        <button
          type="button"
          disabled={loading || pendingScenario !== null}
          onClick={() => handleSelect("TEMP_WARNING")}
          className={`px-3 py-2 border text-xs font-mono font-medium transition-colors flex items-center gap-2 ${
            activeScenario === "TEMP_WARNING"
              ? "bg-[#D9822B] text-white border-[#D9822B]"
              : "bg-[#F5F4F0] hover:bg-[#EBEAE5] text-[#181816] border-[#DCDAD4]"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>ПРЕДУПРЕЖДЕНИЕ ТЕМП.</span>
        </button>

        {/* 4. Fire Alarm */}
        <button
          type="button"
          disabled={loading || pendingScenario !== null}
          onClick={() => handleSelect("FIRE_ALARM")}
          className={`px-3 py-2 border text-xs font-mono font-semibold transition-colors flex items-center gap-2 ${
            activeScenario === "FIRE_ALARM"
              ? "bg-[#C92A2A] text-white border-[#C92A2A] animate-pulse"
              : "bg-[#FDECEC] hover:bg-[#FCD8D8] text-[#C92A2A] border-[#C92A2A]/40"
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>ПОЖАРНАЯ ТРЕВОГА (ЦОД)</span>
        </button>

        {/* 5. Device Offline */}
        <button
          type="button"
          disabled={loading || pendingScenario !== null}
          onClick={() => handleSelect("DEVICE_OFFLINE")}
          className={`px-3 py-2 border text-xs font-mono font-medium transition-colors flex items-center gap-2 ${
            activeScenario === "DEVICE_OFFLINE"
              ? "bg-[#687076] text-white border-[#687076]"
              : "bg-[#F5F4F0] hover:bg-[#EBEAE5] text-[#181816] border-[#DCDAD4]"
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>ОТКАЗ СВЯЗИ ДАТЧИКА</span>
        </button>
      </div>

      {/* Engineering Disclaimer */}
      <div className="flex items-start gap-2 pt-1 font-mono text-[10px] text-[#8E8C84] leading-relaxed">
        <ShieldAlert className="w-3.5 h-3.5 text-[#D9822B] shrink-0 mt-0.5" />
        <span>
          ВНИМАНИЕ: Демонстрационная симуляция для хакатона. Записи помечаются флагом{" "}
          <code>is_demo = true</code>. Не является сертифицированным прибором приемно-контрольным
          пожарным (ППКП).
        </span>
      </div>
    </div>
  );
};
