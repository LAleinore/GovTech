import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  AlertOctagon,
  ArrowUpRight,
  BatteryCharging,
  Box,
  CheckCircle2,
  Clock,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import {
  Button,
  ErrorState,
  LoadingState,
  SectionHeader,
  StatusSignal,
  SignalVariant,
} from "../ui/Primitives";

export interface ZoneDTO {
  id: number;
  code: string;
  name: string;
  zone_type: string;
  risk_level: string;
}

export interface FloorDTO {
  id: number;
  building_id: number;
  floor_number: number;
  name: string;
  elevation_meters: number;
  zones?: ZoneDTO[];
}

export interface BuildingDetailDTO {
  id: number;
  code: string;
  name: string;
  address: string;
  floors_count: number;
  description?: string;
  is_demo?: boolean;
  floors?: FloorDTO[];
}

export interface SensorReadingDTO {
  id?: number;
  metric_type: string;
  value: number;
  unit: string;
  timestamp?: string;
  battery_level?: number | null;
  signal_strength?: number | null;
}

export interface SensorDTO {
  id: number;
  zone_id?: number;
  code: string;
  name: string;
  sensor_type: string;
  status: SignalVariant;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  battery_level: number;
  signal_strength: number;
  model_number?: string;
  latest_reading?: SensorReadingDTO | null;
  zone_name?: string;
  floor_number?: number;
}

export interface IncidentDTO {
  id: number;
  incident_number: string;
  title: string;
  priority: string;
  status: string;
  assigned_user?: string | null;
  created_at: string;
}

interface MainDashboardProps {
  building: BuildingDetailDTO | null;
  sensors: SensorDTO[];
  incidents?: IncidentDTO[];
  loading: boolean;
  error: string | null;
  apiConnected: boolean;
  onRefresh: () => void;
}

export const MainDashboard: React.FC<MainDashboardProps> = ({
  building,
  sensors,
  incidents = [],
  loading,
  error,
  apiConnected,
  onRefresh,
}) => {
  const [selectedFloor, setSelectedFloor] = useState<number | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "ALARM" | "WARNING" | "NORMAL">("ALL");

  // Metrics computation from real database records
  const totalSensors = sensors.length;
  const normalSensors = sensors.filter((s) => s.status === "NORMAL");
  const warningSensors = sensors.filter((s) => s.status === "WARNING");
  const alarmSensors = sensors.filter((s) => s.status === "ALARM");
  const offlineSensors = sensors.filter(
    (s) => s.status === "OFFLINE" || s.status === "FAULT"
  );

  // Overall building safety status
  const overallStatus: SignalVariant = useMemo(() => {
    if (alarmSensors.length > 0) return "ALARM";
    if (warningSensors.length > 0) return "WARNING";
    if (!apiConnected && totalSensors === 0) return "OFFLINE";
    return "NORMAL";
  }, [alarmSensors.length, warningSensors.length, apiConnected, totalSensors]);

  // Average telemetry health from real records
  const avgBattery = useMemo(() => {
    if (totalSensors === 0) return 0;
    const sum = sensors.reduce((acc, s) => acc + (s.battery_level || 0), 0);
    return Math.round(sum / totalSensors);
  }, [sensors, totalSensors]);

  const avgSignal = useMemo(() => {
    if (totalSensors === 0) return 0;
    const sum = sensors.reduce((acc, s) => acc + (s.signal_strength || 0), 0);
    return Math.round(sum / totalSensors);
  }, [sensors, totalSensors]);

  // Sensor equipment breakdown
  const smokeCount = sensors.filter((s) => s.sensor_type.includes("SMOKE")).length;
  const heatCount = sensors.filter((s) => s.sensor_type.includes("HEAT")).length;
  const gasCount = sensors.filter(
    (s) => s.sensor_type.includes("GAS") || s.sensor_type.includes("COMBINED")
  ).length;

  // Filtered sensor list for the telemetry ledger
  const filteredSensors = useMemo(() => {
    return sensors.filter((s) => {
      const matchSearch =
        searchQuery === "" ||
        s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = activeTab === "ALL" || s.status === activeTab;
      return matchSearch && matchStatus;
    });
  }, [sensors, searchQuery, activeTab]);

  // Chronological recent telemetry events from sensor readings
  const recentEvents = useMemo(() => {
    const list: Array<{
      id: string;
      sensorCode: string;
      sensorName: string;
      text: string;
      time: string;
      status: SignalVariant;
      metric: string;
    }> = [];

    sensors.forEach((s) => {
      if (s.latest_reading) {
        list.push({
          id: `${s.id}-${s.latest_reading.metric_type}`,
          sensorCode: s.code,
          sensorName: s.name,
          text: `Телеметрия: ${s.latest_reading.value} ${s.latest_reading.unit} (${s.latest_reading.metric_type})`,
          time: s.latest_reading.timestamp
            ? new Date(s.latest_reading.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            : "Текущее",
          status: s.status,
          metric: `${s.latest_reading.value} ${s.latest_reading.unit}`,
        });
      }
    });

    return list;
  }, [sensors]);

  // Open / unclosed incidents
  const openIncidents = incidents.filter(
    (inc) => inc.status !== "CLOSED" && inc.status !== "RESOLVED"
  );

  return (
    <div className="space-y-6">
      {/* ====================================================================
       * 1. SECTION HEADER WITH DISPATCH TELEMETRY & ACTIONS
       * ==================================================================== */}
      <SectionHeader
        indexCode="CMD // 01 — СИТУАЦИОННАЯ ПАНЕЛЬ"
        title={building ? building.name : "Главная панель мониторинга"}
        subtitle={
          building
            ? `${building.code} • ${building.address} — Оперативный контроль состояния противопожарной защиты, шлейфов телеметрии и 3D-контуров.`
            : "Инженерная система мониторинга цифрового двойника здания."
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              codePrefix="SYNC"
              onClick={onRefresh}
              loading={loading}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Опросить датчики
            </Button>
            <Link to="/digital-twin">
              <Button variant="primary" size="sm" codePrefix="3D">
                Развернуть 3D Twin
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </>
        }
      />

      {loading && <LoadingState message="Опрос шины данных и получение реестра телеметрии..." />}
      {!loading && error && <ErrorState message={error} onRetry={onRefresh} />}

      {/* ====================================================================
       * 2. PRIMARY OPERATIONAL STATUS BANNER (INDUSTRIAL EDITORIAL HERO)
       * ==================================================================== */}
      <div className="border border-[#DCDAD4] bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Overall Health Spec */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#8E8C84]">
                СТАТУС БЕЗОПАСНОСТИ ОБЪЕКТА
              </span>
              <span className="text-[#DCDAD4]">|</span>
              <span className="font-mono text-[10px] text-[#5C5B56]">
                КОД: {building?.code ?? "BLD-ALPHA"}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <StatusSignal
                status={overallStatus}
                label={
                  overallStatus === "ALARM"
                    ? "ПОЖАРНАЯ ТРЕВОГА // ТРЕБУЕТСЯ РЕАГИРОВАНИЕ"
                    : overallStatus === "WARNING"
                    ? "ВНИМАНИЕ // ПРЕВЫШЕНИЕ ПРЕДЕЛЬНЫХ ЗНАЧЕНИЙ"
                    : overallStatus === "OFFLINE"
                    ? "АВТОНОМНЫЙ РЕЖИМ // НЕТ СВЯЗИ С ШИНОЙ"
                    : "НОРМА // ВСЕ КОНТУРЫ БЕЗОПАСНОСТИ В ПРЕДЕЛАХ ДОПУСКА"
                }
              />
            </div>

            <p className="text-xs text-[#5C5B56] max-w-2xl leading-relaxed">
              {overallStatus === "NORMAL"
                ? "Автоматический контроль 3 зон и этажных пространств активен. Телеметрия извещателей задымления, температуры и угарного газа не фиксирует превышений нормативных параметров."
                : overallStatus === "ALARM"
                ? "Зафиксировано срабатывание пожарной сигнализации. Локализуйте зону возгорания на 3D-модели и следуйте регламенту диспетчера."
                : "Отклонение параметров от контрольной нормы. Рекомендуется внеплановая проверка шлейфа извещателей."}
            </p>
          </div>

          {/* Right: Quick Telemetry Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4 shrink-0 font-mono text-xs border-t lg:border-t-0 lg:border-l border-[#DCDAD4] pt-4 lg:pt-0 lg:pl-6">
            <div className="border border-[#DCDAD4] bg-[#F5F4F0] p-3 space-y-1">
              <span className="text-[10px] text-[#8E8C84] block uppercase">УЗЛОВ В СЕТИ</span>
              <span className="text-xl font-bold text-[#181816] tabular-nums">
                {totalSensors}
              </span>
              <span className="text-[10px] text-[#5C5B56] block">
                {normalSensors.length} ОК • {offlineSensors.length} ОФФ
              </span>
            </div>

            <div className="border border-[#DCDAD4] bg-[#F5F4F0] p-3 space-y-1">
              <span className="text-[10px] text-[#8E8C84] block uppercase">ТРЕВОГ / АВАРИЙ</span>
              <span
                className={`text-xl font-bold tabular-nums ${
                  alarmSensors.length > 0 ? "text-[#C92A2A]" : "text-[#1F8844]"
                }`}
              >
                {alarmSensors.length}
              </span>
              <span className="text-[10px] text-[#5C5B56] block">
                {warningSensors.length} ВНИМАНИЕ
              </span>
            </div>

            <div className="border border-[#DCDAD4] bg-[#F5F4F0] p-3 space-y-1">
              <span className="text-[10px] text-[#8E8C84] block uppercase">СРЕДНИЙ ЗАРЯД</span>
              <span className="text-xl font-bold text-[#181816] tabular-nums">
                {avgBattery}%
              </span>
              <span className="text-[10px] text-[#5C5B56] flex items-center gap-1">
                <BatteryCharging className="w-3 h-3 text-[#1F8844]" />
                БАТАРЕИ ОК
              </span>
            </div>

            <div className="border border-[#DCDAD4] bg-[#F5F4F0] p-3 space-y-1">
              <span className="text-[10px] text-[#8E8C84] block uppercase">РАДИОКАНАЛ</span>
              <span className="text-xl font-bold text-[#181816] tabular-nums">
                {avgSignal}%
              </span>
              <span className="text-[10px] text-[#5C5B56] flex items-center gap-1">
                <Radio className="w-3 h-3 text-[#D9531E]" />
                MESH 868 MHZ
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================
       * 3. ASYMMETRIC GRID: 3D PREVIEW VIEWPORT + TELEMETRY LEDGER
       * ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Spatial Viewport + Real Sensors Ledger */}
        <div className="lg:col-span-8 space-y-6">
          {/* Architectural Digital Twin Viewport (Module 6 Preview) */}
          <div className="border border-[#DCDAD4] bg-white">
            <div className="px-5 py-3.5 border-b border-[#DCDAD4] flex flex-wrap items-center justify-between gap-3 bg-[#EBEAE5]/40">
              <div className="flex items-center gap-3">
                <Box className="w-4 h-4 text-[#D9531E]" />
                <span className="font-mono text-xs font-semibold text-[#181816] uppercase">
                  VIEWPORT // ПРОСТРАНСТВЕННЫЙ ОБЗОР ЗДАНИЯ
                </span>
                <span className="font-mono text-[10px] text-[#8E8C84] hidden sm:inline">
                  МАСШТАБ 1:100 • {building?.floors_count ?? 2} ЭТАЖА
                </span>
              </div>

              {/* Floor Switcher */}
              <div className="flex items-center gap-1 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedFloor("ALL")}
                  className={`px-2 py-0.5 border text-[11px] transition-colors ${
                    selectedFloor === "ALL"
                      ? "bg-[#181816] text-white border-[#181816]"
                      : "bg-white text-[#5C5B56] border-[#DCDAD4] hover:bg-[#F5F4F0]"
                  }`}
                >
                  ВСЕ ЭТАЖИ
                </button>
                {building?.floors?.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFloor(f.floor_number)}
                    className={`px-2 py-0.5 border text-[11px] transition-colors ${
                      selectedFloor === f.floor_number
                        ? "bg-[#D9531E] text-white border-[#D9531E]"
                        : "bg-white text-[#5C5B56] border-[#DCDAD4] hover:bg-[#F5F4F0]"
                    }`}
                  >
                    ЭТ. {f.floor_number}
                  </button>
                ))}
              </div>
            </div>

            {/* Isometric Spatial Twin Schematic */}
            <div className="p-6 sm:p-8 bg-[#17181A] text-white relative select-none overflow-hidden min-h-[260px] flex flex-col justify-between">
              {/* Floor Plan Wireframe Graphic */}
              <div className="relative z-10 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="font-mono text-[10px] text-[#D9531E] uppercase tracking-widest block">
                      ARCHITECTURAL DIGITAL TWIN // PREVIEW
                    </span>
                    <h3 className="text-lg sm:text-xl font-semibold tracking-tight text-white mt-1">
                      {selectedFloor === "ALL"
                        ? `Сводная схема: ${building?.name ?? "Корпус Alpha"}`
                        : `Срез уровня: Этаж ${selectedFloor}`}
                    </h3>
                  </div>

                  <Link to="/digital-twin">
                    <Button variant="secondary" size="sm" codePrefix="3D-SCENE">
                      Интерактивная 3D-сцена
                    </Button>
                  </Link>
                </div>

                {/* Spatial Floor Projection Slices */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {building?.floors?.map((floor) => {
                    const isVisible =
                      selectedFloor === "ALL" || selectedFloor === floor.floor_number;
                    if (!isVisible) return null;

                    // Sensor markers located on this floor
                    const floorSensors = sensors.filter(
                      (s) =>
                        (floor.floor_number === 1 && s.pos_z <= 3.5) ||
                        (floor.floor_number === 2 && s.pos_z > 3.5)
                    );

                    return (
                      <div
                        key={floor.id}
                        className="border border-white/20 bg-white/5 p-4 space-y-3 relative group hover:border-[#D9531E]/60 transition-colors"
                      >
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <span className="font-mono text-xs font-semibold text-white">
                            ЭТАЖ {floor.floor_number} // {floor.name}
                          </span>
                          <span className="font-mono text-[10px] text-[#96948E]">
                            ОТМЕТКА: +{floor.elevation_meters.toFixed(1)}M
                          </span>
                        </div>

                        <div className="space-y-1.5 font-mono text-xs">
                          <div className="text-[10px] text-[#96948E] uppercase">
                            ПОЖАРНЫЕ ЗОНЫ И ОТСЕКИ:
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {floor.zones?.map((z) => (
                              <span
                                key={z.id}
                                className="px-2 py-0.5 bg-white/10 border border-white/15 text-[10px] text-white"
                              >
                                {z.code} • {z.name}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Placed Sensors in this floor */}
                        <div className="pt-2 border-t border-white/10 font-mono text-[11px] space-y-1">
                          <div className="flex items-center justify-between text-[#96948E]">
                            <span>УЗЛОВ ТЕЛЕМЕТРИИ:</span>
                            <span className="text-white font-semibold tabular-nums">
                              {floorSensors.length} шт.
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {floorSensors.map((s) => (
                              <span
                                key={s.id}
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] border ${
                                  s.status === "ALARM"
                                    ? "bg-[#C92A2A]/20 border-[#C92A2A] text-[#FF8787]"
                                    : s.status === "WARNING"
                                    ? "bg-[#D9822B]/20 border-[#D9822B] text-[#FFC078]"
                                    : "bg-white/10 border-white/20 text-[#DCDAD4]"
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 ${
                                    s.status === "ALARM"
                                      ? "bg-[#C92A2A] animate-ping"
                                      : s.status === "WARNING"
                                      ? "bg-[#D9822B]"
                                      : "bg-[#1F8844]"
                                  }`}
                                />
                                {s.code} [{s.pos_x}, {s.pos_y}]
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Viewport Footer Legend */}
              <div className="relative z-10 pt-6 mt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] text-[#96948E]">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-[#1F8844]" /> НОРМА
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-[#D9822B]" /> ВНИМАНИЕ
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-[#C92A2A]" /> ТРЕВОГА
                  </span>
                </div>
                <div>КООРДИНАТНАЯ СИСТЕМА: ISO METRIC [X, Y, Z]</div>
              </div>
            </div>
          </div>

          {/* Sensor Operational Ledger */}
          <div className="border border-[#DCDAD4] bg-white">
            <div className="p-4 sm:p-5 border-b border-[#DCDAD4] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="font-mono text-[10px] text-[#8E8C84] uppercase block">
                  РЕЕСТР ДАТЧИКОВ И ПОКАЗАНИЙ // DATABASE SYNC
                </span>
                <h3 className="text-base font-semibold text-[#181816]">
                  Телеметрия узлов безопасности
                </h3>
              </div>

              {/* Status Tabs Filter */}
              <div className="flex items-center gap-1 border border-[#DCDAD4] p-0.5 bg-[#F5F4F0] font-mono text-xs">
                {(["ALL", "NORMAL", "WARNING", "ALARM"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`px-2.5 py-1 text-[11px] transition-colors ${
                      activeTab === tab
                        ? "bg-white font-semibold text-[#181816] shadow-sm"
                        : "text-[#5C5B56] hover:text-[#181816]"
                    }`}
                  >
                    {tab === "ALL" ? `ВСЕ (${totalSensors})` : tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Search inside Table */}
            <div className="p-4 border-b border-[#DCDAD4] bg-[#F5F4F0]/40 flex items-center gap-3">
              <Search className="w-4 h-4 text-[#8E8C84]" />
              <input
                type="text"
                placeholder="Фильтр по коду датчика (напр. SN-101) или названию..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs text-[#181816] placeholder:text-[#8E8C84] focus:outline-none font-mono"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="font-mono text-xs text-[#8E8C84] hover:text-[#181816]"
                >
                  Очистить
                </button>
              )}
            </div>

            {/* Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#DCDAD4] bg-[#F5F4F0] font-mono text-[10px] text-[#5C5B56] uppercase">
                    <th className="py-2.5 px-4">Код узла</th>
                    <th className="py-2.5 px-4">Оборудование / Тип</th>
                    <th className="py-2.5 px-4">Координаты [X, Y, Z]</th>
                    <th className="py-2.5 px-4">Текущее показание</th>
                    <th className="py-2.5 px-4">Питание / Линк</th>
                    <th className="py-2.5 px-4">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCDAD4] text-xs">
                  {filteredSensors.map((sensor) => (
                    <tr key={sensor.id} className="hover:bg-[#F5F4F0]/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-[#181816]">
                        {sensor.code}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#181816]">{sensor.name}</div>
                        <div className="font-mono text-[10px] text-[#8E8C84]">
                          ТИП: {sensor.sensor_type}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#5C5B56] tabular-nums">
                        [{sensor.pos_x.toFixed(1)}, {sensor.pos_y.toFixed(1)},{" "}
                        {sensor.pos_z.toFixed(1)}]
                      </td>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-[#181816] tabular-nums">
                        {sensor.latest_reading ? (
                          <span>
                            {sensor.latest_reading.value} {sensor.latest_reading.unit}
                          </span>
                        ) : (
                          <span className="text-[#8E8C84]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#5C5B56] tabular-nums">
                        {sensor.battery_level}% / {sensor.signal_strength}%
                      </td>
                      <td className="py-3 px-4">
                        <StatusSignal status={sensor.status} />
                      </td>
                    </tr>
                  ))}

                  {filteredSensors.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center">
                        <div className="max-w-sm mx-auto space-y-2">
                          <span className="font-mono text-xs uppercase tracking-wider text-[#8E8C84] block">
                            ДАТЧИКИ НЕ НАЙДЕНЫ
                          </span>
                          <p className="text-xs text-[#5C5B56]">
                            По заданным параметрам поиска или фильтрации записи отсутствуют в
                            базе данных.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Editorial Column (4 cols): Alarms, Incidents & Recent Events Stream */}
        <aside className="lg:col-span-4 space-y-6">
          {/* Active Alarms Card */}
          <div className="border border-[#DCDAD4] bg-white p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#DCDAD4] pb-3">
              <div className="flex items-center gap-2">
                <AlertOctagon
                  className={`w-4 h-4 ${
                    alarmSensors.length > 0 ? "text-[#C92A2A]" : "text-[#1F8844]"
                  }`}
                />
                <span className="font-mono text-xs font-semibold text-[#181816] uppercase">
                  АКТИВНЫЕ ТРЕВОГИ [{alarmSensors.length}]
                </span>
              </div>
              {alarmSensors.length > 0 && <StatusSignal status="ALARM" />}
            </div>

            {alarmSensors.length === 0 ? (
              <div className="border border-[#DCDAD4] bg-[#F5F4F0] p-4 text-center space-y-1.5">
                <CheckCircle2 className="w-5 h-5 text-[#1F8844] mx-auto" />
                <div className="font-mono text-xs font-semibold text-[#181816]">
                  АКТИВНЫХ ТРЕВОГ НЕТ
                </div>
                <p className="text-[11px] text-[#5C5B56] leading-relaxed">
                  Все оптические, тепловые и газовые извещатели работают в штатном диапазоне.
                  Пороговые значения не превышены.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {alarmSensors.map((alarm) => (
                  <div
                    key={alarm.id}
                    className="border-l-4 border-l-[#C92A2A] border border-[#DCDAD4] p-3 space-y-2 bg-[#FDECEC]/30"
                  >
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span className="font-bold text-[#C92A2A]">{alarm.code}</span>
                      <span className="text-[#8E8C84]">ТРЕВОГА</span>
                    </div>
                    <div className="text-xs font-medium text-[#181816]">{alarm.name}</div>
                    <div className="font-mono text-[11px] text-[#5C5B56]">
                      ЗНАЧЕНИЕ:{" "}
                      <strong>
                        {alarm.latest_reading
                          ? `${alarm.latest_reading.value} ${alarm.latest_reading.unit}`
                          : "ПОРОГ ПРЕВЫШЕН"}
                      </strong>
                    </div>
                    <Link to="/incidents">
                      <Button variant="danger" size="sm" codePrefix="DISPATCH" className="w-full">
                        Перейти к инциденту
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Open Incidents Card */}
          <div className="border border-[#DCDAD4] bg-white p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#DCDAD4] pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#D9531E]" />
                <span className="font-mono text-xs font-semibold text-[#181816] uppercase">
                  НЕЗАКРЫТЫЕ ИНЦИДЕНТЫ [{openIncidents.length}]
                </span>
              </div>
              <Link to="/incidents" className="font-mono text-xs text-[#D9531E] hover:underline">
                Журнал →
              </Link>
            </div>

            {openIncidents.length === 0 ? (
              <div className="border border-[#DCDAD4] bg-[#F5F4F0] p-4 text-center space-y-1.5">
                <ShieldCheck className="w-5 h-5 text-[#5C5B56] mx-auto" />
                <div className="font-mono text-xs font-semibold text-[#181816]">
                  ОПЕРАТИВНАЯ ОЧЕРЕДЬ ЧИСТА
                </div>
                <p className="text-[11px] text-[#5C5B56] leading-relaxed">
                  Нет открытых инцидентов, требующих реагирования дежурного персонала или
                  инженерной службы.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {openIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="border border-[#DCDAD4] p-3 space-y-1 hover:bg-[#F5F4F0] transition-colors"
                  >
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span className="font-semibold text-[#181816]">{inc.incident_number}</span>
                      <span className="text-[#D9531E]">{inc.priority}</span>
                    </div>
                    <div className="text-xs text-[#181816]">{inc.title}</div>
                    <div className="font-mono text-[10px] text-[#8E8C84] flex items-center justify-between pt-1">
                      <span>СТАТУС: {inc.status}</span>
                      <span>{inc.assigned_user ? `@${inc.assigned_user}` : "НЕ НАЗНАЧЕН"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Events / Activity Stream from Real Sensor Readings */}
          <div className="border border-[#DCDAD4] bg-white p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#DCDAD4] pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#5C5B56]" />
                <span className="font-mono text-xs font-semibold text-[#181816] uppercase">
                  ПОСЛЕДНИЕ СОБЫТИЯ // ШИНА
                </span>
              </div>
              <span className="font-mono text-[10px] text-[#8E8C84]">LIVE DB</span>
            </div>

            {recentEvents.length === 0 ? (
              <div className="border border-[#DCDAD4] bg-[#F5F4F0] p-4 text-center">
                <span className="font-mono text-xs text-[#8E8C84]">СОБЫТИЙ НЕ ЗАФИКСИРОВАНО</span>
              </div>
            ) : (
              <div className="space-y-3 font-mono text-xs">
                {recentEvents.slice(0, 5).map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-start gap-3 border-b border-[#DCDAD4] pb-2.5 last:border-b-0 last:pb-0"
                  >
                    <div className="w-1.5 h-1.5 bg-[#D9531E] mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-[#181816] truncate">
                          {ev.sensorCode}
                        </span>
                        <span className="text-[10px] text-[#8E8C84] shrink-0 tabular-nums">
                          {ev.time}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#5C5B56] leading-tight font-sans truncate">
                        {ev.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Equipment Composition Summary */}
          <div className="border border-[#DCDAD4] bg-[#EBEAE5] p-4 space-y-2.5 font-mono text-xs">
            <div className="text-[10px] uppercase tracking-wider text-[#5C5B56] font-semibold">
              СПЕЦИФИКАЦИЯ ОБОРУДОВАНИЯ
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#5C5B56]">ДЫМОВЫЕ ИЗВЕЩАТЕЛИ:</span>
                <span className="font-semibold tabular-nums">{smokeCount} ШТ.</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5C5B56]">ТЕПЛОВЫЕ ИЗВЕЩАТЕЛИ:</span>
                <span className="font-semibold tabular-nums">{heatCount} ШТ.</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5C5B56]">ГАЗОВЫЕ / КОМБИНИРОВАННЫЕ:</span>
                <span className="font-semibold tabular-nums">{gasCount} ШТ.</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
