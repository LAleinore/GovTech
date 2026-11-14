import React, { useState, useMemo, useCallback } from "react";
import {
  Activity,
  AlertCircle,
  Clock,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Thermometer,
  Wind,
  X,
  Zap,
} from "lucide-react";
import {
  Button,
  ErrorState,
  LoadingState,
  SectionHeader,
  StatusSignal,
} from "../ui/Primitives";
import { SensorDTO, BuildingDetailDTO, SensorReadingDTO } from "../dashboard/MainDashboard";

interface SensorsMonitoringViewProps {
  building: BuildingDetailDTO | null;
  sensors: SensorDTO[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export const SensorsMonitoringView: React.FC<SensorsMonitoringViewProps> = ({
  building,
  sensors,
  loading,
  error,
  onRefresh,
}) => {
  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFloor, setSelectedFloor] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // History Drawer State
  const [historySensor, setHistorySensor] = useState<SensorDTO | null>(null);
  const [historyReadings, setHistoryReadings] = useState<SensorReadingDTO[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Map zoneId to Zone and Floor information
  const zoneInfoMap = useMemo(() => {
    const map = new Map<number, { zoneCode: string; zoneName: string; floorNum: number; floorName: string }>();
    if (building?.floors) {
      building.floors.forEach((floor) => {
        if (floor.zones) {
          floor.zones.forEach((zone) => {
            map.set(zone.id, {
              zoneCode: zone.code,
              zoneName: zone.name,
              floorNum: floor.floor_number,
              floorName: floor.name,
            });
          });
        }
      });
    }
    return map;
  }, [building]);

  // Helper to determine floor for a sensor
  const getSensorLocation = useCallback(
    (sensor: SensorDTO) => {
      if (sensor.zone_id && zoneInfoMap.has(sensor.zone_id)) {
        return zoneInfoMap.get(sensor.zone_id)!;
      }
      // Geometric fallback based on pos_y or pos_z
      let fNum = 1;
      if (sensor.pos_y > 7.5 || sensor.pos_z > 6.0) fNum = 3;
      else if (sensor.pos_y > 3.5 || sensor.pos_z > 2.5) fNum = 2;

      return {
        zoneCode: `Z-${fNum}01`,
        zoneName: fNum === 1 ? "Главный вестибюль" : fNum === 2 ? "Центральная серверная" : "Инженерный опенспейс",
        floorNum: fNum,
        floorName: `Этаж ${fNum}`,
      };
    },
    [zoneInfoMap]
  );

  // Fetch telemetry history for selected sensor from existing API
  const fetchSensorHistory = useCallback(async (sensor: SensorDTO) => {
    setHistorySensor(sensor);
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch(`/api/v1/sensors/${sensor.id}/readings?limit=50`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Ошибка загрузки истории показаний`);
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setHistoryReadings(data);
      } else {
        setHistoryReadings([]);
      }
    } catch (err: unknown) {
      setHistoryError(err instanceof Error ? err.message : "Ошибка загрузки истории показаний");
      // If sensor history query fails or offline, provide whatever latest reading exists
      if (sensor.latest_reading) {
        setHistoryReadings([sensor.latest_reading]);
      } else {
        setHistoryReadings([]);
      }
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Filtered sensors logic
  const filteredSensors = useMemo(() => {
    return sensors.filter((sensor) => {
      const loc = getSensorLocation(sensor);

      // Search query filter (matches code, name, zoneCode, zoneName)
      const matchSearch =
        searchQuery === "" ||
        sensor.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sensor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loc.zoneCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loc.zoneName.toLowerCase().includes(searchQuery.toLowerCase());

      // Floor filter
      const matchFloor =
        selectedFloor === "ALL" || String(loc.floorNum) === selectedFloor;

      // Type filter
      const matchType =
        selectedType === "ALL" ||
        (selectedType === "SMOKE" && sensor.sensor_type.includes("SMOKE")) ||
        (selectedType === "HEAT" && sensor.sensor_type.includes("HEAT")) ||
        (selectedType === "COMBINED" &&
          (sensor.sensor_type.includes("COMBINED") || sensor.sensor_type.includes("GAS")));

      // Status filter
      const matchStatus =
        selectedStatus === "ALL" || sensor.status === selectedStatus;

      return matchSearch && matchFloor && matchType && matchStatus;
    });
  }, [sensors, searchQuery, selectedFloor, selectedType, selectedStatus, getSensorLocation]);

  // Telemetry counts
  const smokeCount = sensors.filter((s) => s.sensor_type.includes("SMOKE")).length;
  const heatCount = sensors.filter((s) => s.sensor_type.includes("HEAT")).length;
  const combinedCount = sensors.filter(
    (s) => s.sensor_type.includes("COMBINED") || s.sensor_type.includes("GAS")
  ).length;

  const normalCount = sensors.filter((s) => s.status === "NORMAL").length;
  const warningCount = sensors.filter((s) => s.status === "WARNING").length;
  const alarmCount = sensors.filter((s) => s.status === "ALARM").length;
  const faultCount = sensors.filter((s) => s.status === "FAULT" || s.status === "OFFLINE").length;

  return (
    <div className="space-y-6">
      {/* ====================================================================
       * 1. SECTION HEADER
       * ==================================================================== */}
      <SectionHeader
        indexCode="MOD // 03 — РЕЕСТР И МОНИТОРИНГ ДАТЧИКОВ"
        title="Мониторинг извещателей и телеметрия"
        subtitle="Инженерный реестр оборудования противопожарной защиты: оптические извещатели задымления, тепловые датчики и комбинированные анализаторы."
        actions={
          <Button
            variant="secondary"
            size="sm"
            codePrefix="SYNC"
            onClick={onRefresh}
            loading={loading}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Опросить шлейфы
          </Button>
        }
      />

      {loading && <LoadingState message="Синхронизация шлейфов извещателей с базой данных..." />}
      {!loading && error && <ErrorState message={error} onRetry={onRefresh} />}

      {/* ====================================================================
       * 2. TELEMETRY STATUS BAR & SPECIFICATION OVERVIEW
       * ==================================================================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 font-mono text-xs">
        <div className="border border-[#DCDAD4] bg-white p-4 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-[#8E8C84]">
            <span className="text-[10px] uppercase">ВСЕГО ИЗВЕЩАТЕЛЕЙ</span>
            <Activity className="w-3.5 h-3.5 text-[#5C5B56]" />
          </div>
          <div className="text-2xl font-bold text-[#181816] tabular-nums">
            {sensors.length}
          </div>
          <div className="text-[11px] text-[#5C5B56]">
            {normalCount} В ШТАТНОМ РЕЖИМЕ
          </div>
        </div>

        <div className="border border-[#DCDAD4] bg-white p-4 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-[#8E8C84]">
            <span className="text-[10px] uppercase">ДЫМОВЫЕ (SMOKE)</span>
            <Wind className="w-3.5 h-3.5 text-[#5C5B56]" />
          </div>
          <div className="text-2xl font-bold text-[#181816] tabular-nums">
            {smokeCount}
          </div>
          <div className="text-[11px] text-[#5C5B56]">Оптический контроль %/m</div>
        </div>

        <div className="border border-[#DCDAD4] bg-white p-4 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-[#8E8C84]">
            <span className="text-[10px] uppercase">ТЕПЛОВЫЕ (HEAT)</span>
            <Thermometer className="w-3.5 h-3.5 text-[#D9531E]" />
          </div>
          <div className="text-2xl font-bold text-[#181816] tabular-nums">
            {heatCount}
          </div>
          <div className="text-[11px] text-[#5C5B56]">Порог темп. 58.0 °C</div>
        </div>

        <div className="border border-[#DCDAD4] bg-white p-4 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-[#8E8C84]">
            <span className="text-[10px] uppercase">КОМБИ / ГАЗ</span>
            <Zap className="w-3.5 h-3.5 text-[#1F8844]" />
          </div>
          <div className="text-2xl font-bold text-[#181816] tabular-nums">
            {combinedCount}
          </div>
          <div className="text-[11px] text-[#5C5B56]">Контроль CO (ppm)</div>
        </div>
      </div>

      {/* ====================================================================
       * 3. MULTI-PARAMETRIC SEARCH & FILTER CONTROL BAR
       * ==================================================================== */}
      <div className="border border-[#DCDAD4] bg-white p-4 sm:p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-[#DCDAD4] pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#D9531E]" />
            <span className="font-mono text-xs font-semibold uppercase text-[#181816]">
              ФИЛЬТРАЦИЯ И ДИСПЕТЧЕРСКИЙ ПОИСК УЗЛОВ
            </span>
          </div>
          {(searchQuery || selectedFloor !== "ALL" || selectedType !== "ALL" || selectedStatus !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedFloor("ALL");
                setSelectedType("ALL");
                setSelectedStatus("ALL");
              }}
              className="font-mono text-xs text-[#D9531E] hover:underline flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Сбросить фильтры
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Text Search Input */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-[#8E8C84] uppercase">
              ПОИСК ПО ИМЕНИ / КОДУ / ЗОНЕ
            </label>
            <div className="relative flex items-center">
              <Search className="w-4 h-4 absolute left-3 text-[#8E8C84] pointer-events-none" />
              <input
                type="text"
                placeholder="Например: SN-201 или Серверная..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-[#DCDAD4] focus:border-[#181816] text-xs font-mono focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* 2. Floor Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-[#8E8C84] uppercase">
              ЭТАЖ РАЗМЕЩЕНИЯ
            </label>
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#DCDAD4] focus:border-[#181816] text-xs font-mono focus:outline-none transition-colors"
            >
              <option value="ALL">Все этажи здания</option>
              <option value="1">1 этаж — Входная группа и диспетчерская</option>
              <option value="2">2 этаж — Серверная и электрощитовая</option>
              <option value="3">3 этаж — Инженерный опенспейс</option>
            </select>
          </div>

          {/* 3. Sensor Type Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-[#8E8C84] uppercase">
              ТИП ИЗВЕЩАТЕЛЯ
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#DCDAD4] focus:border-[#181816] text-xs font-mono focus:outline-none transition-colors"
            >
              <option value="ALL">Все типы извещателей</option>
              <option value="SMOKE">Дымовой (SMOKE — оптический)</option>
              <option value="HEAT">Тепловой (HEAT — температурный)</option>
              <option value="COMBINED">Комбинированный / CO (GAS)</option>
            </select>
          </div>

          {/* 4. Status Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-[#8E8C84] uppercase">
              СОСТОЯНИЕ УЗЛА
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#DCDAD4] focus:border-[#181816] text-xs font-mono focus:outline-none transition-colors"
            >
              <option value="ALL">Любое состояние ({sensors.length})</option>
              <option value="NORMAL">NORMAL — Штатный режим ({normalCount})</option>
              <option value="WARNING">WARNING — Предупреждение ({warningCount})</option>
              <option value="ALARM">ALARM — Пожарная тревога ({alarmCount})</option>
              <option value="OFFLINE">OFFLINE / FAULT — Нет связи ({faultCount})</option>
            </select>
          </div>
        </div>
      </div>

      {/* ====================================================================
       * 4. SENSORS TABLE / LEDGER
       * ==================================================================== */}
      <div className="border border-[#DCDAD4] bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#DCDAD4] flex items-center justify-between bg-[#F5F4F0]/60">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-[#181816] uppercase">
              РЕЕСТР ТЕЛЕМЕТРИИ
            </span>
            <span className="font-mono text-xs text-[#8E8C84]">
              (ОТОБРАНО: {filteredSensors.length} ИЗ {sensors.length})
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans">
            <thead>
              <tr className="border-b border-[#DCDAD4] bg-[#F5F4F0] font-mono text-[10px] text-[#5C5B56] uppercase">
                <th className="py-2.5 px-4">Код / Марка</th>
                <th className="py-2.5 px-4">Наименование узла</th>
                <th className="py-2.5 px-4">Тип оборудования</th>
                <th className="py-2.5 px-4">Локация (Этаж / Зона)</th>
                <th className="py-2.5 px-4">Текущее показание</th>
                <th className="py-2.5 px-4">Состояние</th>
                <th className="py-2.5 px-4">Посл. опрос</th>
                <th className="py-2.5 px-4 text-right">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCDAD4] text-xs">
              {filteredSensors.map((sensor) => {
                const loc = getSensorLocation(sensor);
                const hasReading = sensor.latest_reading !== null && sensor.latest_reading !== undefined;
                const readingTime = sensor.latest_reading?.timestamp
                  ? new Date(sensor.latest_reading.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })
                  : "Не опрашивался";

                return (
                  <tr
                    key={sensor.id}
                    className="hover:bg-[#F5F4F0]/70 transition-colors group"
                  >
                    {/* Sensor Code */}
                    <td className="py-3 px-4 font-mono font-bold text-[#181816]">
                      {sensor.code}
                      {sensor.model_number && (
                        <div className="text-[10px] font-normal text-[#8E8C84]">
                          {sensor.model_number}
                        </div>
                      )}
                    </td>

                    {/* Sensor Name */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-[#181816]">{sensor.name}</div>
                      <div className="font-mono text-[10px] text-[#8E8C84]">
                        [X: {sensor.pos_x.toFixed(1)}, Y: {sensor.pos_y.toFixed(1)}, Z:{" "}
                        {sensor.pos_z.toFixed(1)}]
                      </div>
                    </td>

                    {/* Sensor Type Badge */}
                    <td className="py-3 px-4 font-mono text-[11px]">
                      {sensor.sensor_type.includes("SMOKE") ? (
                        <span className="inline-flex items-center gap-1 text-[#2A3952]">
                          <Wind className="w-3.5 h-3.5 text-[#3E506E]" /> ДЫМОВОЙ
                        </span>
                      ) : sensor.sensor_type.includes("HEAT") ? (
                        <span className="inline-flex items-center gap-1 text-[#9C540D]">
                          <Thermometer className="w-3.5 h-3.5 text-[#D9531E]" /> ТЕПЛОВОЙ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[#146330]">
                          <Zap className="w-3.5 h-3.5 text-[#1F8844]" /> КОМБИ / CO
                        </span>
                      )}
                    </td>

                    {/* Location (Floor & Zone) */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-[#181816]">
                        Этаж {loc.floorNum}
                      </div>
                      <div className="font-mono text-[10px] text-[#5C5B56]">
                        {loc.zoneCode} • {loc.zoneName}
                      </div>
                    </td>

                    {/* Current Telemetry Reading */}
                    <td className="py-3 px-4 font-mono text-xs">
                      {hasReading ? (
                        <span className="font-semibold text-[#181816] tabular-nums">
                          {sensor.latest_reading!.value} {sensor.latest_reading!.unit}
                        </span>
                      ) : (
                        <span className="text-[#8E8C84] italic">Нет данных</span>
                      )}
                    </td>

                    {/* Operational Status */}
                    <td className="py-3 px-4">
                      <StatusSignal status={sensor.status} />
                    </td>

                    {/* Last Telemetry Timestamp */}
                    <td className="py-3 px-4 font-mono text-[11px] text-[#5C5B56] tabular-nums">
                      {readingTime}
                    </td>

                    {/* Action: Open History Drawer */}
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        codePrefix="LOG"
                        onClick={() => fetchSensorHistory(sensor)}
                      >
                        <Clock className="w-3 h-3" />
                        История
                      </Button>
                    </td>
                  </tr>
                );
              })}

              {/* Empty state when filters return no results */}
              {filteredSensors.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <div className="max-w-md mx-auto space-y-3 font-mono text-xs">
                      <AlertCircle className="w-8 h-8 text-[#8E8C84] mx-auto" />
                      <div className="font-semibold text-[#181816] uppercase">
                        ДАТЧИКИ ПО ЗАДАННЫМ ПАРАМЕТРАМ НЕ НАЙДЕНЫ
                      </div>
                      <p className="text-[#5C5B56] font-sans">
                        Попробуйте изменить поисковый запрос, сбросить фильтрацию по этажу или
                        выбрать другое состояние извещателя.
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        codePrefix="RESET"
                        onClick={() => {
                          setSearchQuery("");
                          setSelectedFloor("ALL");
                          setSelectedType("ALL");
                          setSelectedStatus("ALL");
                        }}
                      >
                        Сбросить все параметры
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ====================================================================
       * 5. SENSOR TELEMETRY HISTORY MODAL / DRAWER
       * ==================================================================== */}
      {historySensor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#181816]/60 backdrop-blur-[1px] p-4">
          <div className="bg-white border border-[#DCDAD4] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#DCDAD4] flex items-center justify-between bg-[#F5F4F0]">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 font-mono text-[10px] text-[#D9531E] uppercase">
                  <span>ЖУРНАЛ ИЗМЕРЕНИЙ УЗЛА</span>
                  <span>•</span>
                  <span>{historySensor.code}</span>
                </div>
                <h3 className="text-base font-semibold text-[#181816]">
                  {historySensor.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHistorySensor(null)}
                className="p-1.5 border border-[#DCDAD4] text-[#5C5B56] hover:bg-[#EBEAE5] transition-colors"
                aria-label="Закрыть окно"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Subheader: Node Specs */}
            <div className="p-4 border-b border-[#DCDAD4] bg-white grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
              <div>
                <span className="text-[10px] text-[#8E8C84] block">ТИП ОБОРУДОВАНИЯ</span>
                <span className="font-semibold text-[#181816]">
                  {historySensor.sensor_type}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#8E8C84] block">ЭТАЖ / ЗОНА</span>
                <span className="font-semibold text-[#181816]">
                  {getSensorLocation(historySensor).zoneCode}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#8E8C84] block">ЗАРЯД БАТАРЕИ</span>
                <span className="font-semibold text-[#181816] tabular-nums">
                  {historySensor.battery_level}%
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#8E8C84] block">СТАТУС ШЛЕЙФА</span>
                <StatusSignal status={historySensor.status} />
              </div>
            </div>

            {/* Modal Content: History Table */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-[#5C5B56] uppercase tracking-wider text-[10px]">
                  ХРОНОЛОГИЯ ПОКАЗАНИЙ (ОТ НОВЫХ К СТАРЫМ)
                </span>
                <span className="text-[#8E8C84]">ЗАПИСЕЙ: {historyReadings.length}</span>
              </div>

              {historyLoading && (
                <div className="p-8 text-center font-mono text-xs text-[#5C5B56] animate-pulse">
                  Запрос телеметрических записей из базы данных...
                </div>
              )}

              {historyError && (
                <div className="p-3 bg-[#FDECEC] border border-[#C92A2A] text-xs font-mono text-[#A61B1B]">
                  ERR // {historyError}
                </div>
              )}

              {!historyLoading && historyReadings.length === 0 && (
                <div className="border border-[#DCDAD4] bg-[#F5F4F0] p-8 text-center space-y-2">
                  <Clock className="w-6 h-6 text-[#8E8C84] mx-auto" />
                  <div className="font-mono text-xs font-semibold text-[#181816]">
                    ИСТОРИЯ ПОКАЗАНИЙ ПУСТА
                  </div>
                  <p className="text-xs text-[#5C5B56] max-w-sm mx-auto">
                    Для данного извещателя пока не зафиксировано сохранённых измерений в базе
                    данных.
                  </p>
                </div>
              )}

              {!historyLoading && historyReadings.length > 0 && (
                <div className="border border-[#DCDAD4] overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#DCDAD4] bg-[#F5F4F0] text-[10px] text-[#5C5B56] uppercase">
                        <th className="py-2 px-3">Время измерения</th>
                        <th className="py-2 px-3">Параметр</th>
                        <th className="py-2 px-3">Значение</th>
                        <th className="py-2 px-3">Батарея</th>
                        <th className="py-2 px-3">Линк</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DCDAD4]">
                      {historyReadings.map((r, idx) => (
                        <tr key={r.id ?? idx} className="hover:bg-[#F5F4F0]/60">
                          <td className="py-2 px-3 tabular-nums text-[#181816]">
                            {r.timestamp
                              ? new Date(r.timestamp).toLocaleString([], {
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })
                              : "—"}
                          </td>
                          <td className="py-2 px-3 text-[#5C5B56]">{r.metric_type}</td>
                          <td className="py-2 px-3 font-bold text-[#181816] tabular-nums">
                            {r.value} {r.unit}
                          </td>
                          <td className="py-2 px-3 tabular-nums text-[#5C5B56]">
                            {r.battery_level !== undefined ? `${r.battery_level}%` : "—"}
                          </td>
                          <td className="py-2 px-3 tabular-nums text-[#5C5B56]">
                            {r.signal_strength !== undefined ? `${r.signal_strength}%` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#DCDAD4] bg-[#F5F4F0] flex items-center justify-between">
              <span className="font-mono text-[10px] text-[#8E8C84]">
                ИСТОЧНИК: SQLITE // SENSOR_READINGS
              </span>
              <Button
                variant="secondary"
                size="sm"
                codePrefix="ESC"
                onClick={() => setHistorySensor(null)}
              >
                Закрыть
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
