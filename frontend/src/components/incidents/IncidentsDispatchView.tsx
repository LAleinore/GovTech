import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import {
  Button,
  ErrorState,
  LoadingState,
  SectionHeader,
  StatusSignal,
} from "../ui/Primitives";

export type IncidentStatusType =
  | "NEW"
  | "ACKNOWLEDGED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED";

export type IncidentPriorityType = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface IncidentLogItem {
  id: number;
  action: string;
  previous_state: string | null;
  new_state: string | null;
  notes: string | null;
  actor_name: string | null;
  created_at: string;
}

export interface IncidentItem {
  id: number;
  incident_number: string;
  alarm_id?: number | null;
  zone_id?: number | null;
  title: string;
  description?: string | null;
  priority: IncidentPriorityType;
  status: IncidentStatusType;
  assigned_user_id?: number | null;
  assigned_user_name?: string | null;
  resolution_notes?: string | null;
  closed_at?: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  zone_code?: string | null;
  zone_name?: string | null;
  floor_number?: number | null;
  building_name?: string | null;
  sensor_code?: string | null;
  logs?: IncidentLogItem[];
}

export interface AlarmItem {
  id: number;
  sensor_id?: number | null;
  zone_id?: number | null;
  title: string;
  description?: string | null;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED" | "FALSE_ALARM";
  trigger_value: number;
  threshold_value: number;
  triggered_at: string;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  is_demo: boolean;
  sensor_code?: string | null;
  zone_code?: string | null;
  incident_id?: number | null;
}

export const IncidentsDispatchView: React.FC = () => {
  // Navigation Tabs: ALARMS vs INCIDENTS
  const [activeTab, setActiveTab] = useState<"INCIDENTS" | "ALARMS">("INCIDENTS");

  // Alarms & Incidents Data State
  const [alarms, setAlarms] = useState<AlarmItem[]>([]);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [alarmStatusFilter, setAlarmStatusFilter] = useState<string>("ALL");
  const [incidentStatusFilter, setIncidentStatusFilter] = useState<string>("ALL");
  const [timeFilter, setTimeFilter] = useState<string>("ALL");

  // Selected Incident Detail State
  const [selectedIncident, setSelectedIncident] = useState<IncidentItem | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modal Action Form States
  const [assigneeName, setAssigneeName] = useState("");
  const [commentText, setCommentText] = useState("");
  const [resolutionText, setResolutionText] = useState("");
  const [closingModalOpen, setClosingModalOpen] = useState(false);

  // Fetch Alarms & Incidents
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [alarmsRes, incidentsRes] = await Promise.all([
        fetch("/api/v1/alarms"),
        fetch("/api/v1/incidents"),
      ]);

      if (alarmsRes.ok) {
        const aData = await alarmsRes.json();
        if (Array.isArray(aData)) setAlarms(aData);
      }
      if (incidentsRes.ok) {
        const iData = await incidentsRes.json();
        if (Array.isArray(iData)) setIncidents(iData);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка обмена данными с API");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load detailed incident specs with chronological audit trail
  const loadIncidentDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/incidents/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Ошибка загрузки деталей инцидента`);
      const detail = await res.json();
      setSelectedIncident(detail);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Не удалось загрузить инцидент");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Create incident from alarm
  const handleCreateIncidentFromAlarm = async (alarmId: number) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/alarms/${alarmId}/create-incident`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Ошибка создания инцидента`);
      const created = await res.json();
      await fetchData();
      if (created.id) {
        await loadIncidentDetail(created.id);
        setActiveTab("INCIDENTS");
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Ошибка создания инцидента");
    }
  };

  // Acknowledge alarm
  const handleAcknowledgeAlarm = async (alarmId: number) => {
    try {
      const res = await fetch(`/api/v1/alarms/${alarmId}/acknowledge`, { method: "POST" });
      if (res.ok) {
        await fetchData();
      }
    } catch {
      // fallback
    }
  };

  // Update status of incident
  const handleUpdateStatus = async (
    targetStatus: IncidentStatusType,
    notes?: string,
    resolutionNotes?: string
  ) => {
    if (!selectedIncident) return;
    setActionError(null);

    // Frontend validation for closing requirement
    if (targetStatus === "CLOSED" && (!resolutionNotes || !resolutionNotes.trim())) {
      setActionError("Для закрытия инцидента (CLOSED) обязательно указать результат обработки.");
      return;
    }

    try {
      const res = await fetch(`/api/v1/incidents/${selectedIncident.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          new_status: targetStatus,
          notes: notes || undefined,
          resolution_notes: resolutionNotes || undefined,
          actor_name: "Дежурный диспетчер",
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `HTTP ${res.status}: Ошибка обновления статуса`);
      }

      const updated = await res.json();
      setSelectedIncident(updated);
      setClosingModalOpen(false);
      setResolutionText("");
      await fetchData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Ошибка изменения статуса");
    }
  };

  // Assign user to incident
  const handleAssignOperator = async () => {
    if (!selectedIncident || !assigneeName.trim()) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/incidents/${selectedIncident.id}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_name: assigneeName.trim(),
          notes: "Назначен дежурным администратором смены",
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}: Ошибка назначения сотрудника`);
      const updated = await res.json();
      setSelectedIncident(updated);
      setAssigneeName("");
      await fetchData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Ошибка назначения сотрудника");
    }
  };

  // Add operational comment
  const handleAddComment = async () => {
    if (!selectedIncident || !commentText.trim()) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/incidents/${selectedIncident.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: commentText.trim(),
          actor_name: "Дежурный оператор",
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}: Ошибка добавления комментария`);
      const updated = await res.json();
      setSelectedIncident(updated);
      setCommentText("");
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Ошибка записи комментария");
    }
  };

  // Filtered Alarms
  const filteredAlarms = useMemo(() => {
    return alarms.filter((a) => {
      const matchSearch =
        searchQuery === "" ||
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.sensor_code && a.sensor_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.zone_code && a.zone_code.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus =
        alarmStatusFilter === "ALL" || a.status === alarmStatusFilter;

      // Time Filter (e.g. Last 1 hour, Last 24 hours)
      let matchTime = true;
      if (timeFilter === "1H") {
        const threshold = Date.now() - 3600 * 1000;
        matchTime = new Date(a.triggered_at).getTime() >= threshold;
      } else if (timeFilter === "24H") {
        const threshold = Date.now() - 24 * 3600 * 1000;
        matchTime = new Date(a.triggered_at).getTime() >= threshold;
      }

      return matchSearch && matchStatus && matchTime;
    });
  }, [alarms, searchQuery, alarmStatusFilter, timeFilter]);

  // Filtered Incidents
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      const matchSearch =
        searchQuery === "" ||
        inc.incident_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inc.zone_code && inc.zone_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (inc.assigned_user_name &&
          inc.assigned_user_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus =
        incidentStatusFilter === "ALL" || inc.status === incidentStatusFilter;

      return matchSearch && matchStatus;
    });
  }, [incidents, searchQuery, incidentStatusFilter]);

  return (
    <div className="space-y-6">
      {/* ====================================================================
       * 1. SECTION HEADER
       * ==================================================================== */}
      <SectionHeader
        indexCode="MOD // 04 — ДИСПЕТЧЕРИЗАЦИЯ И ИНЦИДЕНТЫ"
        title="Тревоги и управление инцидентами"
        subtitle="Протокол обработки пожарных тревог: фиксация срабатываний, назначение ответственных, контроль регламентов реагирования и закрытие инцидентов."
        actions={
          <Button
            variant="secondary"
            size="sm"
            codePrefix="SYNC"
            onClick={fetchData}
            loading={loading}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Обновить очередь
          </Button>
        }
      />

      {loading && <LoadingState message="Синхронизация очереди тревог и карточек инцидентов..." />}
      {!loading && error && <ErrorState message={error} onRetry={fetchData} />}

      {/* ====================================================================
       * 2. MAIN WORKSPACE TABS & METRIC BAR
       * ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DCDAD4] pb-3">
        {/* Navigation Switcher */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("INCIDENTS")}
            className={`px-3 py-2 border text-xs font-semibold uppercase transition-colors flex items-center gap-2 ${
              activeTab === "INCIDENTS"
                ? "bg-[#181816] text-white border-[#181816]"
                : "bg-white text-[#5C5B56] border-[#DCDAD4] hover:bg-[#F5F4F0]"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-[#D9531E]" />
            <span>ОЧЕРЕДЬ ИНЦИДЕНТОВ ({incidents.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ALARMS")}
            className={`px-3 py-2 border text-xs font-semibold uppercase transition-colors flex items-center gap-2 ${
              activeTab === "ALARMS"
                ? "bg-[#181816] text-white border-[#181816]"
                : "bg-white text-[#5C5B56] border-[#DCDAD4] hover:bg-[#F5F4F0]"
            }`}
          >
            <AlertOctagon className="w-3.5 h-3.5 text-[#C92A2A]" />
            <span>ЖУРНАЛ ТРЕВОГ ({alarms.length})</span>
          </button>
        </div>

        {/* Quick Filter Search Input */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center min-w-[260px]">
            <Search className="w-4 h-4 absolute left-3 text-[#8E8C84]" />
            <input
              type="text"
              placeholder={
                activeTab === "INCIDENTS"
                  ? "Поиск по номеру инцидента или зоне..."
                  : "Поиск по тревоге или коду узла..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#DCDAD4] focus:border-[#181816] text-xs font-mono focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* ====================================================================
       * 3. TAB CONTENT: INCIDENTS VIEW OR ALARMS VIEW
       * ==================================================================== */}
      {activeTab === "INCIDENTS" ? (
        /* ======================== INCIDENTS SECTION ======================== */
        <div className="space-y-4">
          {/* Status Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-[#DCDAD4] p-3 font-mono text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[#8E8C84] uppercase mr-2 text-[10px]">СТАТУС:</span>
              {(["ALL", "NEW", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const).map(
                (st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setIncidentStatusFilter(st)}
                    className={`px-2.5 py-1 text-[11px] border transition-colors ${
                      incidentStatusFilter === st
                        ? "bg-[#181816] text-white border-[#181816]"
                        : "bg-[#F5F4F0] text-[#5C5B56] border-[#DCDAD4] hover:bg-[#EBEAE5]"
                    }`}
                  >
                    {st === "ALL" ? "ВСЕ" : st}
                  </button>
                )
              )}
            </div>

            <span className="text-[11px] text-[#5C5B56]">
              ОТОБРАНО: {filteredIncidents.length} ИЗ {incidents.length}
            </span>
          </div>

          {/* Incidents Table */}
          <div className="border border-[#DCDAD4] bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#DCDAD4] bg-[#F5F4F0] font-mono text-[10px] text-[#5C5B56] uppercase">
                    <th className="py-2.5 px-4">Номер инцидента</th>
                    <th className="py-2.5 px-4">Приоритет</th>
                    <th className="py-2.5 px-4">Наименование / Источник</th>
                    <th className="py-2.5 px-4">Локация (Зона / Этаж)</th>
                    <th className="py-2.5 px-4">Ответственный</th>
                    <th className="py-2.5 px-4">Статус</th>
                    <th className="py-2.5 px-4">Время создания</th>
                    <th className="py-2.5 px-4 text-right">Карточка</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCDAD4]">
                  {filteredIncidents.map((inc) => (
                    <tr key={inc.id} className="hover:bg-[#F5F4F0]/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#181816]">
                        {inc.incident_number}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <span
                          className={`px-2 py-0.5 text-[10px] border ${
                            inc.priority === "CRITICAL"
                              ? "bg-[#FDECEC] border-[#C92A2A] text-[#A61B1B]"
                              : inc.priority === "HIGH"
                              ? "bg-[#FDF3E7] border-[#D9822B] text-[#9C540D]"
                              : "bg-[#E9F5EE] border-[#1F8844] text-[#146330]"
                          }`}
                        >
                          {inc.priority}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#181816]">{inc.title}</div>
                        {inc.sensor_code && (
                          <div className="font-mono text-[10px] text-[#8E8C84]">
                            ИСТОЧНИК: {inc.sensor_code}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#5C5B56]">
                        {inc.zone_code ? `${inc.zone_code} (${inc.zone_name})` : "—"}
                        {inc.floor_number && ` • Эт. ${inc.floor_number}`}
                      </td>
                      <td className="py-3 px-4">
                        {inc.assigned_user_name ? (
                          <span className="font-medium text-[#181816] flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5 text-[#1F8844]" />
                            {inc.assigned_user_name}
                          </span>
                        ) : (
                          <span className="font-mono text-[11px] text-[#8E8C84] italic">
                            НЕ НАЗНАЧЕН
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[10px] border font-semibold ${
                            inc.status === "CLOSED"
                              ? "bg-[#ECEEF0] border-[#687076]/40 text-[#495057]"
                              : inc.status === "RESOLVED"
                              ? "bg-[#E9F5EE] border-[#1F8844]/40 text-[#146330]"
                              : inc.status === "IN_PROGRESS"
                              ? "bg-[#FDF3E7] border-[#D9822B]/40 text-[#9C540D]"
                              : inc.status === "ACKNOWLEDGED"
                              ? "bg-[#E8EEF5] border-[#3E506E]/40 text-[#2A3952]"
                              : "bg-[#FDECEC] border-[#C92A2A]/40 text-[#A61B1B]"
                          }`}
                        >
                          {inc.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#5C5B56] tabular-nums">
                        {new Date(inc.created_at).toLocaleString([], {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          codePrefix="OPEN"
                          onClick={() => loadIncidentDetail(inc.id)}
                        >
                          Разбор
                        </Button>
                      </td>
                    </tr>
                  ))}

                  {filteredIncidents.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center">
                        <div className="max-w-md mx-auto space-y-2 font-mono text-xs">
                          <ShieldCheck className="w-8 h-8 text-[#8E8C84] mx-auto" />
                          <div className="font-semibold text-[#181816]">
                            НЕТ ИНЦИДЕНТОВ ПО ВЫБРАННЫМ КРИТЕРИЯМ
                          </div>
                          <p className="text-[#5C5B56]">
                            Очередь реагирования чиста. Для симуляции возгорания используйте
                            демо-панель сверху.
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
      ) : (
        /* ======================== ALARMS SECTION ======================== */
        <div className="space-y-4">
          {/* Alarms Status & Time Filters */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-[#DCDAD4] p-3 font-mono text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[#8E8C84] uppercase mr-2 text-[10px]">СТАТУС ТРЕВОГИ:</span>
              {(["ALL", "ACTIVE", "ACKNOWLEDGED", "RESOLVED"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setAlarmStatusFilter(st)}
                  className={`px-2.5 py-1 text-[11px] border transition-colors ${
                    alarmStatusFilter === st
                      ? "bg-[#181816] text-white border-[#181816]"
                      : "bg-[#F5F4F0] text-[#5C5B56] border-[#DCDAD4] hover:bg-[#EBEAE5]"
                  }`}
                >
                  {st === "ALL" ? "ВСЕ" : st}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[#8E8C84] uppercase text-[10px]">ВРЕМЯ:</span>
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="bg-[#F5F4F0] border border-[#DCDAD4] px-2 py-1 text-xs font-mono"
              >
                <option value="ALL">За все время</option>
                <option value="1H">За последний 1 час</option>
                <option value="24H">За последние 24 часа</option>
              </select>
            </div>
          </div>

          {/* Alarms Table */}
          <div className="border border-[#DCDAD4] bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#DCDAD4] bg-[#F5F4F0] font-mono text-[10px] text-[#5C5B56] uppercase">
                    <th className="py-2.5 px-4">Уровень / Код</th>
                    <th className="py-2.5 px-4">Наименование тревоги</th>
                    <th className="py-2.5 px-4">Датчик / Локация</th>
                    <th className="py-2.5 px-4">Показание / Порог</th>
                    <th className="py-2.5 px-4">Состояние</th>
                    <th className="py-2.5 px-4">Время сработки</th>
                    <th className="py-2.5 px-4 text-right">Действие</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCDAD4]">
                  {filteredAlarms.map((a) => (
                    <tr key={a.id} className="hover:bg-[#F5F4F0]/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold">
                        <span
                          className={`px-2 py-0.5 text-[10px] border ${
                            a.severity === "CRITICAL" || a.severity === "HIGH"
                              ? "bg-[#FDECEC] border-[#C92A2A] text-[#A61B1B]"
                              : "bg-[#FDF3E7] border-[#D9822B] text-[#9C540D]"
                          }`}
                        >
                          {a.severity}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#181816]">{a.title}</div>
                        {a.description && (
                          <div className="text-[11px] text-[#5C5B56] line-clamp-1">
                            {a.description}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#5C5B56]">
                        {a.sensor_code && <strong>{a.sensor_code}</strong>}
                        {a.zone_code && ` • Зона ${a.zone_code}`}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs tabular-nums">
                        <strong className="text-[#C92A2A]">{a.trigger_value}</strong> /{" "}
                        <span className="text-[#8E8C84]">{a.threshold_value}</span>
                      </td>
                      <td className="py-3 px-4">
                        <StatusSignal
                          status={
                            a.status === "ACTIVE"
                              ? "ALARM"
                              : a.status === "ACKNOWLEDGED"
                              ? "WARNING"
                              : "NORMAL"
                          }
                          label={a.status}
                        />
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#5C5B56] tabular-nums">
                        {new Date(a.triggered_at).toLocaleString([], {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {a.status === "ACTIVE" && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleAcknowledgeAlarm(a.id)}
                          >
                            Принять
                          </Button>
                        )}

                        {a.incident_id ? (
                          <Button
                            variant="primary"
                            size="sm"
                            codePrefix="INC"
                            onClick={() => loadIncidentDetail(a.incident_id!)}
                          >
                            Инцидент
                          </Button>
                        ) : (
                          <Button
                            variant="danger"
                            size="sm"
                            codePrefix="DISPATCH"
                            onClick={() => handleCreateIncidentFromAlarm(a.id)}
                          >
                            Сформировать инцидент
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}

                  {filteredAlarms.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center">
                        <div className="max-w-md mx-auto space-y-2 font-mono text-xs">
                          <CheckCircle2 className="w-8 h-8 text-[#1F8844] mx-auto" />
                          <div className="font-semibold text-[#181816]">АКТИВНЫХ ТРЕВОГ НЕТ</div>
                          <p className="text-[#5C5B56]">
                            Все контуры пожарной безопасности работают в штатном режиме.
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
      )}

      {/* ====================================================================
       * 4. INCIDENT DETAIL CARD / DRAWER
       * ==================================================================== */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#181816]/60 backdrop-blur-[1px] p-4">
          <div className="bg-white border border-[#DCDAD4] w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#DCDAD4] flex items-center justify-between bg-[#F5F4F0]">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="font-bold text-[#D9531E]">
                    {selectedIncident.incident_number}
                  </span>
                  <span className="text-[#DCDAD4]">|</span>
                  <span
                    className={`px-2 py-0.2 text-[10px] border font-bold ${
                      selectedIncident.priority === "CRITICAL"
                        ? "bg-[#FDECEC] border-[#C92A2A] text-[#A61B1B]"
                        : "bg-[#FDF3E7] border-[#D9822B] text-[#9C540D]"
                    }`}
                  >
                    {selectedIncident.priority}
                  </span>
                  <span className="text-[#DCDAD4]">|</span>
                  <span className="font-mono text-[10px] text-[#5C5B56]">
                    СТАТУС: {selectedIncident.status}
                  </span>
                </div>
                <h2 className="text-lg font-semibold text-[#181816]">
                  {selectedIncident.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedIncident(null)}
                className="p-1.5 border border-[#DCDAD4] text-[#5C5B56] hover:bg-[#EBEAE5]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="px-5 py-3 bg-[#FDECEC] border-b border-[#C92A2A] text-xs font-mono text-[#A61B1B]">
                ERR // {actionError}
              </div>
            )}

            {detailLoading && (
              <div className="p-8 text-center font-mono text-xs text-[#5C5B56] animate-pulse">
                Синхронизация карточки инцидента и журнала аудита...
              </div>
            )}

            {/* Modal Body Grid (Details & Timeline) */}
            <div className="p-5 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column (6 cols): Specifications & Actions */}
              <div className="lg:col-span-6 space-y-5">
                {/* Location Spec Box */}
                <div className="border border-[#DCDAD4] p-4 bg-[#F5F4F0] space-y-2 font-mono text-xs">
                  <div className="font-bold text-[#181816] uppercase text-[11px] border-b border-[#DCDAD4] pb-1.5">
                    ПАСПОРТ ЛОКАЦИИ ВОЗГОРАНИЯ
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-[#8E8C84] block">ОБЪЕКТ:</span>
                      <span className="font-medium">{selectedIncident.building_name || "Корпус Alpha"}</span>
                    </div>
                    <div>
                      <span className="text-[#8E8C84] block">ЭТАЖ:</span>
                      <span className="font-medium">Этаж {selectedIncident.floor_number ?? 2}</span>
                    </div>
                    <div>
                      <span className="text-[#8E8C84] block">ПОЖАРНЫЙ ОТСЕК:</span>
                      <span className="font-medium">
                        {selectedIncident.zone_code} ({selectedIncident.zone_name})
                      </span>
                    </div>
                    <div>
                      <span className="text-[#8E8C84] block">ИЗВЕЩАТЕЛЬ:</span>
                      <span className="font-medium text-[#D9531E]">
                        {selectedIncident.sensor_code ?? "SN-201-HEAT"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Assigned Personnel */}
                <div className="border border-[#DCDAD4] p-4 bg-white space-y-3">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="text-[10px] text-[#8E8C84] uppercase font-bold">
                      ОТВЕТСТВЕННЫЙ СОТРУДНИК
                    </span>
                    {selectedIncident.assigned_user_name ? (
                      <span className="text-[#1F8844] font-semibold flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5" /> НАЗНАЧЕН
                      </span>
                    ) : (
                      <span className="text-[#D9822B] font-semibold">ТРЕБУЕТСЯ НАЗНАЧЕНИЕ</span>
                    )}
                  </div>

                  <div className="text-sm font-medium text-[#181816]">
                    {selectedIncident.assigned_user_name || "Сотрудник не назначен"}
                  </div>

                  {selectedIncident.status !== "CLOSED" && (
                    <div className="pt-2 flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="ФИО сотрудника или позывной..."
                        value={assigneeName}
                        onChange={(e) => setAssigneeName(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-[#F5F4F0] border border-[#DCDAD4] text-xs font-mono focus:outline-none"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        codePrefix="ASSIGN"
                        onClick={handleAssignOperator}
                      >
                        Назначить
                      </Button>
                    </div>
                  )}
                </div>

                {/* Status Transitions Bar */}
                <div className="border border-[#DCDAD4] p-4 bg-white space-y-3">
                  <div className="font-mono text-[10px] text-[#8E8C84] uppercase font-bold">
                    УПРАВЛЕНИЕ ЖИЗНЕННЫМ ЦИКЛОМ (СТАТУС: {selectedIncident.status})
                  </div>

                  {selectedIncident.status === "CLOSED" ? (
                    <div className="p-3 bg-[#ECEEF0] border border-[#687076]/40 font-mono text-xs text-[#495057] space-y-1">
                      <div className="font-bold">ИНЦИДЕНТ ЗАКРЫТ // АРХИВ</div>
                      <div className="text-[11px]">
                        РЕЗУЛЬТАТ ОБРАБОТКИ: {selectedIncident.resolution_notes}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedIncident.status === "NEW" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          codePrefix="ACK"
                          onClick={() => handleUpdateStatus("ACKNOWLEDGED", "Принято в обработку")}
                        >
                          Принять [ACKNOWLEDGED]
                        </Button>
                      )}

                      {(selectedIncident.status === "NEW" ||
                        selectedIncident.status === "ACKNOWLEDGED") && (
                        <Button
                          variant="secondary"
                          size="sm"
                          codePrefix="START"
                          onClick={() =>
                            handleUpdateStatus("IN_PROGRESS", "Начаты аварийно-спасательные работы")
                          }
                        >
                          В работу [IN_PROGRESS]
                        </Button>
                      )}

                      {selectedIncident.status === "IN_PROGRESS" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          codePrefix="RESOLVE"
                          onClick={() =>
                            handleUpdateStatus("RESOLVED", "Очаг возгорания ликвидирован")
                          }
                        >
                          Решено [RESOLVED]
                        </Button>
                      )}

                      <Button
                        variant="danger"
                        size="sm"
                        codePrefix="CLOSE"
                        onClick={() => setClosingModalOpen(true)}
                      >
                        Закрыть инцидент [CLOSED]
                      </Button>
                    </div>
                  )}
                </div>

                {/* Close Incident Dialog (Requires resolution notes) */}
                {closingModalOpen && (
                  <div className="border-2 border-[#C92A2A] bg-[#FDECEC]/30 p-4 space-y-3 animate-in fade-in">
                    <div className="flex items-center gap-2 font-mono text-xs font-bold text-[#C92A2A]">
                      <AlertTriangle className="w-4 h-4" />
                      ФИКСАЦИЯ РЕЗУЛЬТАТА И ЗАКРЫТИЕ ИНЦИДЕНТА
                    </div>
                    <p className="text-xs text-[#181816]">
                      Для закрытия инцидента в соответствии с регламентом пожарной безопасности
                      обязательно зафиксируйте результат и причину срабатывания.
                    </p>
                    <textarea
                      rows={3}
                      placeholder="Укажите результат обработки (например: Ложное срабатывание при калибровке; Очаг потушен первичными средствами пожаротушения)..."
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                      className="w-full p-2.5 bg-white border border-[#DCDAD4] text-xs font-mono focus:outline-none"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setClosingModalOpen(false)}
                      >
                        Отмена
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        codePrefix="CONFIRM"
                        onClick={() =>
                          handleUpdateStatus("CLOSED", "Закрытие инцидента", resolutionText)
                        }
                      >
                        Подтвердить закрытие
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column (6 cols): Immutable Audit Trail & Comments */}
              <div className="lg:col-span-6 space-y-4">
                <div className="flex items-center justify-between font-mono text-xs border-b border-[#DCDAD4] pb-2">
                  <span className="font-bold text-[#181816] uppercase">
                    ИСТОРИЯ ИЗМЕНЕНИЙ И ЖУРНАЛ ДЕЙСТВИЙ
                  </span>
                  <span className="text-[#8E8C84]">
                    ЗАПИСЕЙ: {selectedIncident.logs?.length ?? 0}
                  </span>
                </div>

                {/* Audit Timeline */}
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  {selectedIncident.logs?.map((log) => (
                    <div
                      key={log.id}
                      className="border border-[#DCDAD4] bg-[#F5F4F0] p-3 space-y-1 font-mono text-xs"
                    >
                      <div className="flex items-center justify-between text-[10px] text-[#8E8C84]">
                        <span className="font-bold text-[#181816]">{log.action}</span>
                        <span className="tabular-nums">
                          {new Date(log.created_at).toLocaleString([], {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </div>
                      {log.notes && (
                        <p className="text-[11px] text-[#181816] font-sans leading-relaxed pt-0.5">
                          {log.notes}
                        </p>
                      )}
                      <div className="text-[10px] text-[#5C5B56] pt-1 border-t border-[#DCDAD4] flex justify-between">
                        <span>АВТОР: {log.actor_name || "Дежурный диспетчер"}</span>
                        {log.new_state && <span>НОВЫЙ СТАТУС: {log.new_state}</span>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Comment Input */}
                {selectedIncident.status !== "CLOSED" && (
                  <div className="pt-2 border-t border-[#DCDAD4] space-y-2">
                    <div className="font-mono text-[10px] text-[#8E8C84] uppercase font-bold">
                      ДОБАВИТЬ ОПЕРАТИВНЫЙ КОММЕНТАРИЙ
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Текст служебной отметки..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        className="flex-1 px-3 py-2 bg-white border border-[#DCDAD4] text-xs font-mono focus:outline-none"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        codePrefix="NOTE"
                        onClick={handleAddComment}
                      >
                        Записать
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#DCDAD4] bg-[#F5F4F0] flex items-center justify-between font-mono text-xs">
              <span className="text-[#8E8C84] text-[10px]">
                БАЗА ДАННЫХ: INCIDENTS + INCIDENT_LOGS
              </span>
              <Button variant="secondary" size="sm" onClick={() => setSelectedIncident(null)}>
                Закрыть карточку
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
