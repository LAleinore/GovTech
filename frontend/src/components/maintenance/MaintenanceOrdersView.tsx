import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit2,
  FileCheck,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  Wrench,
  X,
} from "lucide-react";
import {
  Button,
  ErrorState,
  LoadingState,
  SectionHeader,
  FieldInput,
  FieldSelect,
} from "../ui/Primitives";
import { SensorDTO } from "../dashboard/MainDashboard";

export type MaintenanceTaskStatusType =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "OVERDUE"
  | "CANCELLED";

export type MaintenanceTaskTypeEnum =
  | "INSPECTION"
  | "BATTERY_REPLACEMENT"
  | "RECALIBRATION"
  | "REPAIR";

export interface MaintenanceTaskItem {
  id: number;
  title: string;
  description?: string | null;
  task_type: MaintenanceTaskTypeEnum;
  status: MaintenanceTaskStatusType;
  scheduled_date?: string | null;
  completed_date?: string | null;
  resolution_notes?: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  sensor_id?: number | null;
  sensor_code?: string | null;
  sensor_name?: string | null;
  building_name?: string | null;
  floor_number?: number | null;
  zone_code?: string | null;
  zone_name?: string | null;
  assigned_user_id?: number | null;
  assigned_user_name?: string | null;
}

interface MaintenanceOrdersViewProps {
  sensors?: SensorDTO[];
}

export const MaintenanceOrdersView: React.FC<MaintenanceOrdersViewProps> = ({
  sensors = [],
}) => {
  const [tasks, setTasks] = useState<MaintenanceTaskItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  // Create / Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<MaintenanceTaskItem | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTaskType, setFormTaskType] = useState<MaintenanceTaskTypeEnum>("INSPECTION");
  const [formSensorId, setFormSensorId] = useState<string>("");
  const [formTechName, setFormTechName] = useState("");
  const [formScheduledDate, setFormScheduledDate] = useState("");
  const [formStatus, setFormStatus] = useState<string>("PENDING");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Complete Task Modal State
  const [completingTask, setCompletingTask] = useState<MaintenanceTaskItem | null>(null);
  const [resolutionReport, setResolutionReport] = useState("");
  const [completeSubmitting, setCompleteSubmitting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  // Fetch Tasks
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/maintenance");
      if (!res.ok) throw new Error(`HTTP ${res.status}: Ошибка загрузки задач ТО`);
      const data = await res.json();
      if (Array.isArray(data)) setTasks(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Не удалось связаться с сервером ТО");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingTask(null);
    setFormTitle("");
    setFormDescription("");
    setFormTaskType("INSPECTION");
    setFormSensorId(sensors.length > 0 ? String(sensors[0].id) : "");
    setFormTechName("Смирнов И. П. (Техник ПБ)");
    setFormScheduledDate(new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0]);
    setFormStatus("PENDING");
    setFormError(null);
    setIsEditModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (task: MaintenanceTaskItem) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDescription(task.description || "");
    setFormTaskType(task.task_type);
    setFormSensorId(task.sensor_id ? String(task.sensor_id) : "");
    setFormTechName(task.assigned_user_name || "");
    setFormScheduledDate(
      task.scheduled_date ? new Date(task.scheduled_date).toISOString().split("T")[0] : ""
    );
    setFormStatus(task.status === "OVERDUE" ? "PENDING" : task.status);
    setFormError(null);
    setIsEditModalOpen(true);
  };

  // Save Create or Edit
  const handleSubmitEditForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formTitle.trim()) {
      setFormError("Укажите наименование регламентной работы");
      return;
    }

    setFormSubmitting(true);
    try {
      if (editingTask) {
        // PATCH
        const res = await fetch(`/api/v1/maintenance/${editingTask.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formTitle.trim(),
            description: formDescription.trim() || null,
            task_type: formTaskType,
            sensor_id: formSensorId ? Number(formSensorId) : null,
            assigned_user_name: formTechName.trim() || null,
            scheduled_date: formScheduledDate ? new Date(formScheduledDate).toISOString() : null,
            status: formStatus,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `HTTP ${res.status}: Ошибка обновления задачи`);
        }
      } else {
        // POST
        const res = await fetch("/api/v1/maintenance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formTitle.trim(),
            description: formDescription.trim() || null,
            task_type: formTaskType,
            sensor_id: formSensorId ? Number(formSensorId) : null,
            assigned_user_name: formTechName.trim() || null,
            scheduled_date: formScheduledDate ? new Date(formScheduledDate).toISOString() : null,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `HTTP ${res.status}: Ошибка создания регламента`);
        }
      }

      setIsEditModalOpen(false);
      await fetchTasks();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Ошибка сохранения регламентного наряда");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Complete Task Action
  const handleCompleteTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingTask || !resolutionReport.trim()) {
      setCompleteError("Укажите результат проведения регламентных работ");
      return;
    }

    setCompleteSubmitting(true);
    setCompleteError(null);
    try {
      const res = await fetch(`/api/v1/maintenance/${completingTask.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolution_notes: resolutionReport.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${res.status}: Ошибка завершения наряда`);
      }

      setCompletingTask(null);
      setResolutionReport("");
      await fetchTasks();
    } catch (err: unknown) {
      setCompleteError(err instanceof Error ? err.message : "Ошибка закрытия наряда ТО");
    } finally {
      setCompleteSubmitting(false);
    }
  };

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchSearch =
        searchQuery === "" ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.sensor_code && t.sensor_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.sensor_name && t.sensor_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.assigned_user_name &&
          t.assigned_user_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus = statusFilter === "ALL" || t.status === statusFilter;
      const matchType = typeFilter === "ALL" || t.task_type === typeFilter;

      return matchSearch && matchStatus && matchType;
    });
  }, [tasks, searchQuery, statusFilter, typeFilter]);

  // Status Metrics
  const pendingCount = tasks.filter((t) => t.status === "PENDING").length;
  const inProgressCount = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const overdueCount = tasks.filter((t) => t.status === "OVERDUE").length;
  const completedCount = tasks.filter((t) => t.status === "COMPLETED").length;

  return (
    <div className="space-y-6">
      {/* ====================================================================
       * 1. SECTION HEADER
       * ==================================================================== */}
      <SectionHeader
        indexCode="MOD // 05 — ТЕХНИЧЕСКОЕ ОБСЛУЖИВАНИЕ"
        title="Регламенты и обслуживание оборудования"
        subtitle="График поверки, метрологической калибровки и плановой замены элементов питания датчиков пожарной автоматики FireGuard 360."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              codePrefix="SYNC"
              onClick={fetchTasks}
              loading={loading}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Обновить наряды
            </Button>
            <Button
              variant="primary"
              size="sm"
              codePrefix="ORDER"
              onClick={handleOpenCreate}
            >
              <Plus className="w-3.5 h-3.5" />
              Создать наряд ТО
            </Button>
          </>
        }
      />

      {loading && <LoadingState message="Загрузка журнала технического обслуживания..." />}
      {!loading && error && <ErrorState message={error} onRetry={fetchTasks} />}

      {/* ====================================================================
       * 2. METRICS CARDS: OVERDUE, IN PROGRESS, PENDING, COMPLETED
       * ==================================================================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
        {/* Overdue Card */}
        <div
          className={`border p-4 space-y-1 shadow-sm ${
            overdueCount > 0
              ? "border-[#C92A2A] bg-[#FDECEC]/30 text-[#A61B1B]"
              : "border-[#DCDAD4] bg-white text-[#181816]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold">ПРОСРОЧЕНО (OVERDUE)</span>
            <AlertTriangle
              className={`w-4 h-4 ${overdueCount > 0 ? "text-[#C92A2A]" : "text-[#8E8C84]"}`}
            />
          </div>
          <div className="text-2xl font-bold tabular-nums">{overdueCount}</div>
          <div className="text-[11px] opacity-80">Требуется немедленный выезд</div>
        </div>

        {/* In Progress */}
        <div className="border border-[#DCDAD4] bg-white p-4 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-[#8E8C84]">
            <span className="text-[10px] uppercase">В РАБОТЕ (IN PROGRESS)</span>
            <Wrench className="w-4 h-4 text-[#D9822B]" />
          </div>
          <div className="text-2xl font-bold text-[#181816] tabular-nums">
            {inProgressCount}
          </div>
          <div className="text-[11px] text-[#5C5B56]">На исполнении у техника</div>
        </div>

        {/* Pending */}
        <div className="border border-[#DCDAD4] bg-white p-4 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-[#8E8C84]">
            <span className="text-[10px] uppercase">ОЖИДАЮТ (PENDING)</span>
            <Clock className="w-4 h-4 text-[#5C5B56]" />
          </div>
          <div className="text-2xl font-bold text-[#181816] tabular-nums">
            {pendingCount}
          </div>
          <div className="text-[11px] text-[#5C5B56]">В плановом графике</div>
        </div>

        {/* Completed */}
        <div className="border border-[#DCDAD4] bg-white p-4 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-[#8E8C84]">
            <span className="text-[10px] uppercase">ЗАВЕРШЕНО (COMPLETED)</span>
            <CheckCircle2 className="w-4 h-4 text-[#1F8844]" />
          </div>
          <div className="text-2xl font-bold text-[#181816] tabular-nums">
            {completedCount}
          </div>
          <div className="text-[11px] text-[#5C5B56]">В архиве поверок</div>
        </div>
      </div>

      {/* ====================================================================
       * 3. SEARCH & FILTERS CONTROLS
       * ==================================================================== */}
      <div className="border border-[#DCDAD4] bg-white p-4 sm:p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCDAD4] pb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold uppercase text-[#181816]">
              ОЧЕРЕДЬ РЕГЛАМЕНТНЫХ НАРЯДОВ
            </span>
            <span className="font-mono text-xs text-[#8E8C84]">
              ({filteredTasks.length} ИЗ {tasks.length})
            </span>
          </div>

          {(searchQuery || statusFilter !== "ALL" || typeFilter !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("ALL");
                setTypeFilter("ALL");
              }}
              className="font-mono text-xs text-[#D9531E] hover:underline flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Сбросить фильтры
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
          {/* Search Box */}
          <div className="relative flex items-center">
            <Search className="w-4 h-4 absolute left-3 text-[#8E8C84]" />
            <input
              type="text"
              placeholder="Поиск по названию, коду узла или технику..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-[#DCDAD4] focus:border-[#181816] text-xs font-mono focus:outline-none"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-[#DCDAD4] text-xs font-mono focus:outline-none"
          >
            <option value="ALL">Все статусы регламентов</option>
            <option value="OVERDUE">OVERDUE — Просроченные наряды ({overdueCount})</option>
            <option value="IN_PROGRESS">IN_PROGRESS — В работе ({inProgressCount})</option>
            <option value="PENDING">PENDING — Ожидают выполнения ({pendingCount})</option>
            <option value="COMPLETED">COMPLETED — Завершённые ({completedCount})</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-[#DCDAD4] text-xs font-mono focus:outline-none"
          >
            <option value="ALL">Все виды регламентов</option>
            <option value="INSPECTION">INSPECTION — Плановая поверка</option>
            <option value="BATTERY_REPLACEMENT">BATTERY — Замена элемента питания</option>
            <option value="RECALIBRATION">RECALIBRATION — Метрологическая калибровка</option>
            <option value="REPAIR">REPAIR — Восстановительный ремонт</option>
          </select>
        </div>
      </div>

      {/* ====================================================================
       * 4. TASKS TABLE
       * ==================================================================== */}
      <div className="border border-[#DCDAD4] bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-sans">
            <thead>
              <tr className="border-b border-[#DCDAD4] bg-[#F5F4F0] font-mono text-[10px] text-[#5C5B56] uppercase">
                <th className="py-2.5 px-4">Код наряда</th>
                <th className="py-2.5 px-4">Оборудование / Тип</th>
                <th className="py-2.5 px-4">Локация (Здание / Зона)</th>
                <th className="py-2.5 px-4">Описание работы</th>
                <th className="py-2.5 px-4">Ответственный техник</th>
                <th className="py-2.5 px-4">Срок / Дата</th>
                <th className="py-2.5 px-4">Статус</th>
                <th className="py-2.5 px-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCDAD4]">
              {filteredTasks.map((task) => (
                <tr key={task.id} className="hover:bg-[#F5F4F0]/60 transition-colors">
                  {/* Task ID */}
                  <td className="py-3 px-4 font-mono font-bold text-[#181816]">
                    #{task.id}
                  </td>

                  {/* Sensor Equipment */}
                  <td className="py-3 px-4">
                    <div className="font-semibold text-[#181816]">
                      {task.sensor_code ? task.sensor_code : "Общий узел объекта"}
                    </div>
                    {task.sensor_name && (
                      <div className="text-[11px] text-[#5C5B56] line-clamp-1">
                        {task.sensor_name}
                      </div>
                    )}
                  </td>

                  {/* Location */}
                  <td className="py-3 px-4 font-mono text-[11px] text-[#5C5B56]">
                    <div>{task.building_name || "Корпус Alpha"}</div>
                    {task.zone_code && (
                      <div>
                        {task.zone_code} {task.zone_name ? `(${task.zone_name})` : ""}
                        {task.floor_number ? ` • Эт. ${task.floor_number}` : ""}
                      </div>
                    )}
                  </td>

                  {/* Description & Task Type */}
                  <td className="py-3 px-4 max-w-xs">
                    <div className="font-semibold text-[#181816]">{task.title}</div>
                    {task.description && (
                      <div className="text-[11px] text-[#5C5B56] line-clamp-1">
                        {task.description}
                      </div>
                    )}
                    {task.resolution_notes && (
                      <div className="font-mono text-[10px] text-[#1F8844] mt-0.5">
                        ОТЧЁТ: {task.resolution_notes}
                      </div>
                    )}
                  </td>

                  {/* Assigned Tech */}
                  <td className="py-3 px-4 font-medium text-[#181816]">
                    {task.assigned_user_name ? (
                      <span className="flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-[#1F8844]" />
                        <span>{task.assigned_user_name}</span>
                      </span>
                    ) : (
                      <span className="font-mono text-[11px] text-[#8E8C84] italic">
                        Не назначен
                      </span>
                    )}
                  </td>

                  {/* Scheduled Date */}
                  <td className="py-3 px-4 font-mono text-[11px] text-[#5C5B56] tabular-nums">
                    {task.scheduled_date ? (
                      new Date(task.scheduled_date).toLocaleDateString([], {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })
                    ) : (
                      <span className="text-[#8E8C84]">—</span>
                    )}
                  </td>

                  {/* Computed Status */}
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[10px] border font-bold ${
                        task.status === "OVERDUE"
                          ? "bg-[#FDECEC] border-[#C92A2A] text-[#A61B1B] animate-pulse"
                          : task.status === "COMPLETED"
                          ? "bg-[#E9F5EE] border-[#1F8844]/40 text-[#146330]"
                          : task.status === "IN_PROGRESS"
                          ? "bg-[#FDF3E7] border-[#D9822B]/40 text-[#9C540D]"
                          : "bg-[#F5F4F0] border-[#8C8A84]/40 text-[#5C5B56]"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 ${
                          task.status === "OVERDUE"
                            ? "bg-[#C92A2A]"
                            : task.status === "COMPLETED"
                            ? "bg-[#1F8844]"
                            : task.status === "IN_PROGRESS"
                            ? "bg-[#D9822B]"
                            : "bg-[#8E8C84]"
                        }`}
                      />
                      <span>{task.status}</span>
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleOpenEdit(task)}
                    >
                      <Edit2 className="w-3 h-3" />
                      Редактировать
                    </Button>

                    {task.status !== "COMPLETED" && (
                      <Button
                        variant="primary"
                        size="sm"
                        codePrefix="DONE"
                        onClick={() => {
                          setCompletingTask(task);
                          setResolutionReport("");
                          setCompleteError(null);
                        }}
                      >
                        Завершить
                      </Button>
                    )}
                  </td>
                </tr>
              ))}

              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <div className="max-w-md mx-auto space-y-2 font-mono text-xs">
                      <FileCheck className="w-8 h-8 text-[#8E8C84] mx-auto" />
                      <div className="font-semibold text-[#181816]">НАРЯДЫ ТО НЕ НАЙДЕНЫ</div>
                      <p className="text-[#5C5B56]">
                        По заданным критериям поиска плановые или выполненные наряды отсутствуют
                        в базе данных.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ====================================================================
       * 5. CREATE / EDIT MAINTENANCE ORDER MODAL
       * ==================================================================== */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#181816]/60 backdrop-blur-[1px] p-4">
          <div className="bg-white border border-[#DCDAD4] w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#DCDAD4] flex items-center justify-between bg-[#F5F4F0]">
              <div className="space-y-0.5">
                <span className="font-mono text-[10px] text-[#D9531E] uppercase">
                  {editingTask ? `НАРЯД ТО #${editingTask.id}` : "НОВЫЙ НАРЯД НА ОБСЛУЖИВАНИЕ"}
                </span>
                <h3 className="text-base font-semibold text-[#181816]">
                  {editingTask ? "Редактирование наряда" : "Формирование регламентного наряда"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 border border-[#DCDAD4] text-[#5C5B56] hover:bg-[#EBEAE5]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="px-5 py-3 bg-[#FDECEC] border-b border-[#C92A2A] text-xs font-mono text-[#A61B1B]">
                ERR // {formError}
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleSubmitEditForm} className="p-5 space-y-4">
              <FieldInput
                label="Наименование регламентной работы"
                techCode="TASK // TITLE"
                placeholder="Например: Замена батареи датчика температуры"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
              />

              <FieldSelect
                label="Целевое оборудование (Извещатель)"
                techCode="TARGET // SENSOR"
                value={formSensorId}
                onChange={(e) => setFormSensorId(e.target.value)}
                options={[
                  { value: "", label: "Общее оборудование объекта" },
                  ...sensors.map((s) => ({
                    value: String(s.id),
                    label: `${s.code} — ${s.name} (${s.sensor_type})`,
                  })),
                ]}
              />

              <FieldSelect
                label="Категория технического обслуживания"
                techCode="ORDER // TYPE"
                value={formTaskType}
                onChange={(e) => setFormTaskType(e.target.value as MaintenanceTaskTypeEnum)}
                options={[
                  { value: "INSPECTION", label: "INSPECTION — Плановый осмотр и поверка" },
                  { value: "BATTERY_REPLACEMENT", label: "BATTERY — Замена элементов питания" },
                  { value: "RECALIBRATION", label: "RECALIBRATION — Метрологическая калибровка" },
                  { value: "REPAIR", label: "REPAIR — Восстановительный ремонт узла" },
                ]}
              />

              <FieldInput
                label="Ответственный техник"
                techCode="TECH // ASSIGNED"
                placeholder="ФИО техника..."
                value={formTechName}
                onChange={(e) => setFormTechName(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-3">
                <FieldInput
                  label="Плановый срок (Deadline)"
                  techCode="SCHED // DATE"
                  type="date"
                  value={formScheduledDate}
                  onChange={(e) => setFormScheduledDate(e.target.value)}
                />

                {editingTask && (
                  <FieldSelect
                    label="Статус выполнения"
                    techCode="TASK // STATUS"
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    options={[
                      { value: "PENDING", label: "PENDING — Ожидает" },
                      { value: "IN_PROGRESS", label: "IN_PROGRESS — В работе" },
                    ]}
                  />
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-[#181816] uppercase tracking-wider text-[11px]">
                  Описание технологической карты
                </label>
                <textarea
                  rows={2}
                  placeholder="Детализация работ, инструмент, спецификация деталей..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#DCDAD4] text-xs font-mono focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-[#DCDAD4] flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  codePrefix="SAVE"
                  loading={formSubmitting}
                >
                  {editingTask ? "Сохранить наряд" : "Сформировать наряд"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
       * 6. COMPLETE TASK DIALOG WITH MANDATORY RESOLUTION REPORT
       * ==================================================================== */}
      {completingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#181816]/60 backdrop-blur-[1px] p-4">
          <div className="bg-white border border-[#DCDAD4] w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-[#DCDAD4] flex items-center justify-between bg-[#F5F4F0]">
              <div className="space-y-0.5">
                <span className="font-mono text-[10px] text-[#1F8844] font-bold uppercase">
                  ФИКСАЦИЯ РЕЗУЛЬТАТА // ЗАКРЫТИЕ НАРЯДА #{completingTask.id}
                </span>
                <h3 className="text-base font-semibold text-[#181816]">
                  {completingTask.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCompletingTask(null)}
                className="p-1.5 border border-[#DCDAD4] text-[#5C5B56] hover:bg-[#EBEAE5]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {completeError && (
              <div className="px-5 py-3 bg-[#FDECEC] border-b border-[#C92A2A] text-xs font-mono text-[#A61B1B]">
                ERR // {completeError}
              </div>
            )}

            <form onSubmit={handleCompleteTask} className="p-5 space-y-4">
              <p className="text-xs text-[#5C5B56] leading-relaxed">
                Для сохранения в архив поверок и завершения регламента внесите техническое
                заключение о состоянии оборудования и проведённых манипуляциях.
              </p>

              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[11px] font-bold text-[#181816] uppercase">
                  Результат работы (Акт выполненных работ) *
                </label>
                <textarea
                  rows={3}
                  placeholder="Например: Произведена продувка фотокамеры, чувствительность восстановлена; Элемент питания CR123A заменен, заряд 100%..."
                  value={resolutionReport}
                  onChange={(e) => setResolutionReport(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#DCDAD4] text-xs font-mono focus:outline-none"
                  required
                />
              </div>

              <div className="pt-4 border-t border-[#DCDAD4] flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setCompletingTask(null)}
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  codePrefix="CLOSE"
                  loading={completeSubmitting}
                >
                  Подтвердить завершение
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
