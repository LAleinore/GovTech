import React, { useEffect, useState, useCallback } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import {
  Button,
  FieldInput,
  FieldSelect,
  SectionHeader,
  StatusSignal,
} from "./components/ui/Primitives";
import {
  MainDashboard,
  BuildingDetailDTO,
  SensorDTO,
} from "./components/dashboard/MainDashboard";
import { DigitalTwinView } from "./components/twin/DigitalTwinView";
import { SensorsMonitoringView } from "./components/sensors/SensorsMonitoringView";
import { IncidentsDispatchView } from "./components/incidents/IncidentsDispatchView";
import { PersonnelManagementView } from "./components/personnel/PersonnelManagementView";
import { MaintenanceOrdersView } from "./components/maintenance/MaintenanceOrdersView";
import { AnalyticsEventLogView } from "./components/analytics/AnalyticsEventLogView";
import {
  SimulationControlBar,
  SimulationScenario,
} from "./components/simulation/SimulationControlBar";
import { FALLBACK_BUILDING, FALLBACK_SENSORS } from "./mockData";

/* ============================================================================
 * UI SYSTEM REFERENCE PAGE ("/ui-system")
 * ============================================================================ */
const DesignSystemPage: React.FC = () => {
  return (
    <div className="space-y-8">
      <SectionHeader
        indexCode="DSG // 00 — INDUSTRIAL EDITORIAL TOKENS"
        title="Инженерная дизайн-система и состояния элементов"
        subtitle="Эталонный набор кнопок, полей ввода, цветовых сигналов, состояний загрузки и ошибок FireGuard 360."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Buttons & Signals */}
        <div className="border border-[#DCDAD4] bg-white p-6 space-y-6">
          <div className="border-b border-[#DCDAD4] pb-3">
            <span className="font-mono text-[10px] text-[#8E8C84] uppercase">
              01 // КНОПКИ И СИГНАЛЫ СОСТОЯНИЯ
            </span>
            <h3 className="text-base font-semibold mt-0.5">Управляющие элементы и статусы</h3>
          </div>

          <div className="space-y-3">
            <div className="font-mono text-xs text-[#5C5B56]">ВАРИАНТЫ КНОПОК:</div>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" codePrefix="ACT">
                Основное действие
              </Button>
              <Button variant="secondary" codePrefix="SEC">
                Вторичная команда
              </Button>
              <Button variant="danger" codePrefix="ALM">
                Подтвердить тревогу
              </Button>
              <Button variant="ghost">Техническая ссылка</Button>
              <Button variant="primary" loading>
                Загрузка
              </Button>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="font-mono text-xs text-[#5C5B56]">СИГНАЛЫ СОСТОЯНИЙ:</div>
            <div className="flex flex-wrap gap-2.5">
              <StatusSignal status="NORMAL" />
              <StatusSignal status="WARNING" />
              <StatusSignal status="ALARM" />
              <StatusSignal status="FAULT" />
              <StatusSignal status="OFFLINE" />
              <StatusSignal status="DEMO" />
            </div>
          </div>
        </div>

        {/* Form Controls */}
        <div className="border border-[#DCDAD4] bg-white p-6 space-y-5">
          <div className="border-b border-[#DCDAD4] pb-3">
            <span className="font-mono text-[10px] text-[#8E8C84] uppercase">
              02 // ПОЛЯ ВВОДА И ПАРАМЕТРЫ
            </span>
            <h3 className="text-base font-semibold mt-0.5">Инженерные контролы ввода</h3>
          </div>

          <FieldInput
            label="Демонстрационный порог температуры"
            techCode="THR // TEMP-MAX"
            defaultValue="58.0"
            unit="°C"
          />

          <FieldSelect
            label="Категория пожарного отсека"
            techCode="ZONE // CLASS"
            options={[
              { value: "SERVER_ROOM", label: "SERVER_ROOM — Серверные и ЦОД" },
              { value: "ELECTRICAL_ROOM", label: "ELECTRICAL_ROOM — Электрощитовые" },
              { value: "LOBBY", label: "LOBBY — Общественные зоны" },
            ]}
          />

          <FieldInput
            label="Пример поля с ошибкой валидации"
            techCode="VAL // ERR"
            defaultValue="INVALID-COORD"
            error="Координата Z выходит за габариты этажа [0.0 .. 12.0]"
          />
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * ROOT APPLICATION
 * ============================================================================ */
export const App: React.FC = () => {
  const [building, setBuilding] = useState<BuildingDetailDTO | null>(null);
  const [sensors, setSensors] = useState<SensorDTO[]>([]);
  const [apiConnected, setApiConnected] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Simulation & WebSocket state
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [currentScenario, setCurrentScenario] = useState<SimulationScenario>("NORMAL");

  const fetchSystemData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch buildings
      const bRes = await fetch("/api/v1/buildings");
      if (!bRes.ok) throw new Error(`HTTP ${bRes.status}: Ошибка получения зданий`);
      const bList = await bRes.json();

      if (Array.isArray(bList) && bList.length > 0) {
        const primary = bList[0];
        // Fetch detailed building info with floors & zones
        try {
          const detailRes = await fetch(`/api/v1/buildings/${primary.id}`);
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            setBuilding(detailData);
          } else {
            setBuilding(primary);
          }
        } catch {
          setBuilding(primary);
        }
      } else {
        setBuilding(null);
      }

      // 2. Fetch sensors
      const sRes = await fetch("/api/v1/sensors");
      if (!sRes.ok) throw new Error(`HTTP ${sRes.status}: Ошибка получения датчиков`);
      const sData = await sRes.json();
      if (Array.isArray(sData)) {
        setSensors(sData);
      } else {
        setSensors([]);
      }

      setApiConnected(true);
    } catch {
      // In offline / static GitHub Pages mode: fall back gracefully to architectural demo data
      setApiConnected(false);
      setBuilding((prev) => prev || FALLBACK_BUILDING);
      setSensors((prev) => (prev && prev.length > 0 ? prev : FALLBACK_SENSORS));
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSystemData();
  }, [fetchSystemData]);

  // Real-time WebSocket connection to event bus
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connectWs = () => {
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws/events`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.scenario) {
              setCurrentScenario(data.scenario as SimulationScenario);
            }
            // Trigger instant refresh across all 2D and 3D views
            fetchSystemData();
          } catch {
            fetchSystemData();
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          reconnectTimeout = setTimeout(connectWs, 5000);
        };

        ws.onerror = () => {
          setWsConnected(false);
        };
      } catch {
        setWsConnected(false);
      }
    };

    connectWs();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [fetchSystemData]);

  const handleTriggerScenario = async (scenario: SimulationScenario) => {
    setCurrentScenario(scenario);
    try {
      const res = await fetch("/api/v1/simulation/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      if (res.ok) {
        await fetchSystemData();
        return;
      }
    } catch {
      // Offline fallback: client-side simulation mutations
    }

    // Client-side scenario handler for GitHub Pages demo mode
    setSensors((prev) => {
      const list = prev && prev.length > 0 ? [...prev] : [...FALLBACK_SENSORS];
      return list.map((s) => {
        if (scenario === "NORMAL") {
          return { ...s, status: "NORMAL" };
        }
        if (scenario === "FIRE_ALARM" && (s.code.includes("HEAT") || s.code.includes("201"))) {
          return { ...s, status: "ALARM" };
        }
        if (scenario === "SMOKE" && (s.code.includes("SMK") || s.code.includes("101"))) {
          return { ...s, status: "WARNING" };
        }
        if (scenario === "TEMP_WARNING" && s.code.includes("HEAT")) {
          return { ...s, status: "WARNING" };
        }
        if (scenario === "DEVICE_OFFLINE" && s.code.includes("GAS")) {
          return { ...s, status: "OFFLINE" };
        }
        return s;
      });
    });
  };

  return (
    <HashRouter>
      <Routes>
        <Route
          element={
            <AppShell
              buildingName={building?.name}
              buildingCode={building?.code}
              apiConnected={apiConnected}
              demoMode={true}
              sensorCount={sensors.length}
              simulationSlot={
                <SimulationControlBar
                  currentScenario={currentScenario}
                  wsConnected={wsConnected}
                  onTriggerScenario={handleTriggerScenario}
                />
              }
            />
          }
        >
          <Route
            path="/"
            element={
              <MainDashboard
                building={building}
                sensors={sensors}
                loading={loading}
                error={error}
                apiConnected={apiConnected}
                onRefresh={fetchSystemData}
              />
            }
          />
          <Route
            path="/digital-twin"
            element={
              <DigitalTwinView
                building={building}
                sensors={sensors}
                onRefresh={fetchSystemData}
              />
            }
          />
          <Route
            path="/monitoring"
            element={
              <SensorsMonitoringView
                building={building}
                sensors={sensors}
                loading={loading}
                error={error}
                onRefresh={fetchSystemData}
              />
            }
          />
          <Route
            path="/incidents"
            element={<IncidentsDispatchView />}
          />
          <Route
            path="/personnel"
            element={<PersonnelManagementView />}
          />
          <Route
            path="/maintenance"
            element={<MaintenanceOrdersView sensors={sensors} />}
          />
          <Route
            path="/analytics"
            element={<AnalyticsEventLogView />}
          />
          <Route path="/ui-system" element={<DesignSystemPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

export default App;
