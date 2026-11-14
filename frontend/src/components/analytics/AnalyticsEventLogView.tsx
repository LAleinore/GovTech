import React, { useEffect, useState, useCallback } from "react";
import {
  SectionHeader,
  StatusSignal,
  Button,
  LoadingState,
  ErrorState,
} from "../ui/Primitives";
import {
  BarChart3,
  Clock,
  Calendar,
  Layers,
  Wrench,
  ShieldAlert,
  Radio,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";

interface AlarmDistributionByFloor {
  floor_number: number;
  count: number;
}

interface AlarmDistributionByType {
  sensor_type: string;
  count: number;
}

interface SensorStateBreakdown {
  total: number;
  normal: number;
  warning: number;
  alarm: number;
  offline: number;
}

interface AnalyticsOverview {
  period: string;
  alarms_count: number;
  alarms_by_floor: AlarmDistributionByFloor[];
  alarms_by_type: AlarmDistributionByType[];
  sensor_states: SensorStateBreakdown;
  avg_incident_resolution_minutes: number | null;
  closed_incidents_count: number;
  overdue_maintenance_count: number;
  total_maintenance_count: number;
}

interface EventLogItem {
  id: string;
  event_type: string;
  title: string;
  description: string | null;
  actor_name: string | null;
  timestamp: string;
  badge_variant: "ALARM" | "WARNING" | "NORMAL" | "DEMO" | "OFFLINE" | string;
}

export const AnalyticsEventLogView: React.FC = () => {
  const [period, setPeriod] = useState<string>("ALL");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("ALL");
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [events, setEvents] = useState<EventLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, eventsRes] = await Promise.all([
        fetch(`/api/v1/analytics/overview?period=${period}`),
        fetch(`/api/v1/analytics/events?event_type=${eventTypeFilter}&limit=100`),
      ]);

      if (!overviewRes.ok || !eventsRes.ok) {
        throw new Error("Не удалось получить аналитические данные с сервера");
      }

      const overviewData: AnalyticsOverview = await overviewRes.json();
      const eventsData: EventLogItem[] = await eventsRes.json();

      setOverview(overviewData);
      setEvents(eventsData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Ошибка сети";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [period, eventTypeFilter]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return ts;
    }
  };

  const getSignalVariant = (badge: string): "NORMAL" | "WARNING" | "ALARM" | "OFFLINE" | "DEMO" => {
    switch (badge.toUpperCase()) {
      case "ALARM":
        return "ALARM";
      case "WARNING":
        return "WARNING";
      case "OFFLINE":
        return "OFFLINE";
      case "DEMO":
        return "DEMO";
      default:
        return "NORMAL";
    }
  };

  const maxFloorCount = overview?.alarms_by_floor
    ? Math.max(...overview.alarms_by_floor.map((f) => f.count), 1)
    : 1;

  const maxTypeCount = overview?.alarms_by_type
    ? Math.max(...overview.alarms_by_type.map((t) => t.count), 1)
    : 1;

  return (
    <div className="space-y-6">
      <SectionHeader
        indexCode="ANL // 06 — METRICS & UNIFIED AUDIT LOG"
        title="Аналитика безопасности и единый журнал событий"
        subtitle="Инженерные метрики надежности (MTTR), распределение тревог по контурам и неизменяемый сквозной аудит действий."
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 border border-[#DCDAD4] bg-white px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#5C5B56]" />
              <span className="font-mono text-xs text-[#5C5B56] uppercase">Период:</span>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="text-xs bg-transparent font-medium text-[#1E1E1C] focus:outline-none cursor-pointer"
              >
                <option value="ALL">Все время</option>
                <option value="24H">Последние 24 часа</option>
                <option value="7D">Последние 7 дней</option>
                <option value="30D">Последние 30 дней</option>
              </select>
            </div>
            <Button
              variant="secondary"
              onClick={fetchAnalytics}
              codePrefix="REFRESH"
              className="py-1 px-3"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        }
      />

      {error && <ErrorState message={error} onRetry={fetchAnalytics} />}

      {loading && !overview ? (
        <LoadingState message="Сборка аналитических показателей и аудит-лога..." />
      ) : (
        <>
          {/* Top Key Metrics Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Alarms */}
            <div className="border border-[#DCDAD4] bg-white p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase text-[#8E8C84] tracking-wider">
                  ТРЕВОГИ ЗА ПЕРИОД
                </span>
                <ShieldAlert className="w-4 h-4 text-[#C93B2B]" />
              </div>
              <div className="mt-3">
                <div className="text-3xl font-semibold font-mono tracking-tight text-[#1E1E1C]">
                  {overview?.alarms_count ?? 0}
                </div>
                <div className="text-xs text-[#5C5B56] mt-1 flex items-center gap-1.5 font-mono">
                  <span>Фактических инцидентов безопасности</span>
                </div>
              </div>
            </div>

            {/* MTTR */}
            <div className="border border-[#DCDAD4] bg-white p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase text-[#8E8C84] tracking-wider">
                  СРЕДНЕЕ ВРЕМЯ РЕАКЦИИ (MTTR)
                </span>
                <Clock className="w-4 h-4 text-[#D96B27]" />
              </div>
              <div className="mt-3">
                <div className="text-3xl font-semibold font-mono tracking-tight text-[#1E1E1C]">
                  {overview?.avg_incident_resolution_minutes !== null &&
                  overview?.avg_incident_resolution_minutes !== undefined
                    ? `${overview.avg_incident_resolution_minutes} мин`
                    : "—"}
                </div>
                <div className="text-xs text-[#5C5B56] mt-1 font-mono">
                  {overview?.closed_incidents_count ?? 0} закрытых инцидентов
                </div>
              </div>
            </div>

            {/* Overdue Maintenance */}
            <div className="border border-[#DCDAD4] bg-white p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase text-[#8E8C84] tracking-wider">
                  ПРОСРОЧЕННЫЕ РАБОТЫ ТО
                </span>
                <Wrench className="w-4 h-4 text-[#C93B2B]" />
              </div>
              <div className="mt-3">
                <div className="text-3xl font-semibold font-mono tracking-tight text-[#C93B2B]">
                  {overview?.overdue_maintenance_count ?? 0}
                </div>
                <div className="text-xs text-[#5C5B56] mt-1 font-mono">
                  из {overview?.total_maintenance_count ?? 0} регламентных нарядов
                </div>
              </div>
            </div>

            {/* Sensors Health */}
            <div className="border border-[#DCDAD4] bg-white p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase text-[#8E8C84] tracking-wider">
                  СОСТОЯНИЕ ПАРКА ИЗВЕЩАТЕЛЕЙ
                </span>
                <Radio className="w-4 h-4 text-[#3E6B48]" />
              </div>
              <div className="mt-3">
                <div className="text-3xl font-semibold font-mono tracking-tight text-[#1E1E1C]">
                  {overview?.sensor_states.normal ?? 0} / {overview?.sensor_states.total ?? 0}
                </div>
                <div className="text-xs text-[#5C5B56] mt-1 flex items-center gap-2 font-mono">
                  <span className="text-[#3E6B48]">● {overview?.sensor_states.normal ?? 0} ОК</span>
                  <span className="text-[#C93B2B]">● {overview?.sensor_states.alarm ?? 0} ТРВ</span>
                  <span className="text-[#8E8C84]">● {overview?.sensor_states.offline ?? 0} OFF</span>
                </div>
              </div>
            </div>
          </div>

          {/* Analytical Visual Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Distribution by Floor */}
            <div className="border border-[#DCDAD4] bg-white p-6">
              <div className="flex items-center justify-between border-b border-[#DCDAD4] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#1E1E1C]" />
                  <h3 className="font-mono text-xs uppercase font-semibold tracking-wider text-[#1E1E1C]">
                    РАСПРЕДЕЛЕНИЕ ТРЕВОГ ПО ЭТАЖАМ ЗДАНИЯ
                  </h3>
                </div>
                <span className="font-mono text-[10px] text-[#8E8C84]">
                  {overview?.alarms_by_floor.length ?? 0} ЭТАЖЕЙ
                </span>
              </div>

              {overview?.alarms_by_floor && overview.alarms_by_floor.length > 0 ? (
                <div className="space-y-4">
                  {overview.alarms_by_floor.map((floor) => {
                    const pct = Math.round((floor.count / maxFloorCount) * 100);
                    return (
                      <div key={floor.floor_number} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-mono">
                          <span className="text-[#1E1E1C] font-semibold">
                            ЭТАЖ {floor.floor_number}
                          </span>
                          <span className="text-[#5C5B56]">
                            {floor.count} {floor.count === 1 ? "тревога" : "тревог"}
                          </span>
                        </div>
                        <div className="w-full bg-[#EAE8E3] h-3.5 relative overflow-hidden flex">
                          <div
                            className="bg-[#D96B27] h-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-[#8E8C84] font-mono text-xs border border-dashed border-[#DCDAD4]">
                  Нет зарегистрированных тревог за выбранный период
                </div>
              )}
            </div>

            {/* Distribution by Sensor Type */}
            <div className="border border-[#DCDAD4] bg-white p-6">
              <div className="flex items-center justify-between border-b border-[#DCDAD4] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#1E1E1C]" />
                  <h3 className="font-mono text-xs uppercase font-semibold tracking-wider text-[#1E1E1C]">
                    РАСПРЕДЕЛЕНИЕ ПО ТИПАМ ДАТЧИКОВ
                  </h3>
                </div>
                <span className="font-mono text-[10px] text-[#8E8C84]">ТИПЫ ПРИБОРОВ</span>
              </div>

              {overview?.alarms_by_type && overview.alarms_by_type.length > 0 ? (
                <div className="space-y-4">
                  {overview.alarms_by_type.map((typeItem) => {
                    const pct = Math.round((typeItem.count / maxTypeCount) * 100);
                    const typeLabel =
                      typeItem.sensor_type === "SMOKE"
                        ? "ДЫМОВОЙ (ИП 212)"
                        : typeItem.sensor_type === "HEAT" || typeItem.sensor_type === "TEMPERATURE"
                        ? "ТЕПЛОВОЙ (ИП 101)"
                        : typeItem.sensor_type === "COMBINED"
                        ? "КОМБИНИРОВАННЫЙ"
                        : typeItem.sensor_type;

                    return (
                      <div key={typeItem.sensor_type} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-mono">
                          <span className="text-[#1E1E1C] font-semibold">{typeLabel}</span>
                          <span className="text-[#5C5B56]">
                            {typeItem.count} {typeItem.count === 1 ? "событие" : "событий"}
                          </span>
                        </div>
                        <div className="w-full bg-[#EAE8E3] h-3.5 relative overflow-hidden flex">
                          <div
                            className="bg-[#C93B2B] h-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-[#8E8C84] font-mono text-xs border border-dashed border-[#DCDAD4]">
                  Нет зарегистрированных срабатываний по типам сенсоров
                </div>
              )}
            </div>
          </div>

          {/* Unified Event Log Stream */}
          <div className="border border-[#DCDAD4] bg-white p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCDAD4] pb-3">
              <div>
                <span className="font-mono text-[10px] uppercase text-[#8E8C84] tracking-wider">
                  АУДИТОРСКИЙ СЛЕД // НЕИЗМЕНЯЕМЫЙ ЖУРНАЛ
                </span>
                <h3 className="text-base font-semibold text-[#1E1E1C]">
                  Единый протокол событий безопасности
                </h3>
              </div>

              {/* Event Filter */}
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#5C5B56]" />
                <span className="font-mono text-xs text-[#5C5B56]">ФИЛЬТР СОБЫТИЙ:</span>
                <select
                  value={eventTypeFilter}
                  onChange={(e) => setEventTypeFilter(e.target.value)}
                  className="text-xs bg-white border border-[#DCDAD4] px-2.5 py-1 text-[#1E1E1C] focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Все типы событий</option>
                  <option value="ALARMS">Только тревоги</option>
                  <option value="INCIDENTS">Инциденты и диспетчеризация</option>
                  <option value="MAINTENANCE">Техническое обслуживание</option>
                </select>
              </div>
            </div>

            {/* Events Table */}
            {events.length === 0 ? (
              <div className="py-12 text-center text-[#8E8C84] font-mono text-xs border border-dashed border-[#DCDAD4]">
                События выбранного типа отсутствуют в журнале аудита.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#DCDAD4] bg-[#F7F6F2] font-mono text-[10px] uppercase text-[#5C5B56]">
                      <th className="py-2.5 px-3">Время (UTC/МСК)</th>
                      <th className="py-2.5 px-3">Статус / Тип</th>
                      <th className="py-2.5 px-3">Событие / Описание</th>
                      <th className="py-2.5 px-3">Инициатор / Субъект</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE8E3] text-xs">
                    {events.map((ev) => (
                      <tr key={ev.id} className="hover:bg-[#FDFCFB] transition-colors">
                        <td className="py-3 px-3 font-mono text-[11px] text-[#5C5B56] whitespace-nowrap">
                          {formatTimestamp(ev.timestamp)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <StatusSignal
                            status={getSignalVariant(ev.badge_variant)}
                            label={ev.event_type.replace(/_/g, " ")}
                          />
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-[#1E1E1C]">{ev.title}</div>
                          {ev.description && (
                            <div className="text-[11px] text-[#5C5B56] mt-0.5 max-w-xl">
                              {ev.description}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-[#1E1E1C] whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-[#8E8C84] rounded-full inline-block" />
                            {ev.actor_name || "Система"}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
