import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Edit2,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  User,
  UserCheck,
  UserX,
  Users,
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

export type UserRoleType = "ADMIN" | "OPERATOR" | "TECHNICIAN" | "DISPATCHER";

export interface EmployeeItem {
  id: number;
  email: string;
  full_name: string;
  role: UserRoleType;
  phone?: string | null;
  is_active: boolean;
  is_demo: boolean;
  assigned_incidents_count: number;
  created_at: string;
  updated_at: string;
}

export const PersonnelManagementView: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modal State: Create or Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeItem | null>(null);
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState<UserRoleType>("OPERATOR");
  const [formPhone, setFormPhone] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Fetch Employees List
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/users");
      if (!res.ok) throw new Error(`HTTP ${res.status}: Ошибка загрузки списка сотрудников`);
      const data = await res.json();
      if (Array.isArray(data)) setEmployees(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Не удалось связаться с сервером персонала");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Open Modal for Create
  const handleOpenCreate = () => {
    setEditingEmployee(null);
    setFormEmail("");
    setFormName("");
    setFormRole("OPERATOR");
    setFormPhone("");
    setFormActive(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (emp: EmployeeItem) => {
    setEditingEmployee(emp);
    setFormEmail(emp.email);
    setFormName(emp.full_name);
    setFormRole(emp.role);
    setFormPhone(emp.phone || "");
    setFormActive(emp.is_active);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Submit Create or Edit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError("Укажите ФИО сотрудника");
      return;
    }
    if (!formEmail.trim() || !formEmail.includes("@")) {
      setFormError("Укажите корректный корпоративный email");
      return;
    }

    setFormSubmitting(true);
    try {
      if (editingEmployee) {
        // PATCH existing user
        const res = await fetch(`/api/v1/users/${editingEmployee.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: formName.trim(),
            role: formRole,
            phone: formPhone.trim() || null,
            is_active: formActive,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `HTTP ${res.status}: Ошибка обновления`);
        }
      } else {
        // POST new user
        const res = await fetch("/api/v1/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formEmail.trim(),
            full_name: formName.trim(),
            role: formRole,
            phone: formPhone.trim() || null,
            is_active: formActive,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `HTTP ${res.status}: Ошибка создания профиля`);
        }
      }

      setIsModalOpen(false);
      await fetchEmployees();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Ошибка сохранения данных сотрудника");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Deactivate User
  const handleDeactivate = async (emp: EmployeeItem) => {
    setError(null);
    try {
      const res = await fetch(`/api/v1/users/${emp.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${res.status}: Ошибка деактивации`);
      }

      await fetchEmployees();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка деактивации учётной записи");
    }
  };

  // Activate User
  const handleActivate = async (emp: EmployeeItem) => {
    setError(null);
    try {
      const res = await fetch(`/api/v1/users/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: true }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${res.status}: Ошибка активации`);
      }

      await fetchEmployees();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка активации учётной записи");
    }
  };

  // Filtered list
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchSearch =
        searchQuery === "" ||
        emp.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (emp.phone && emp.phone.includes(searchQuery));

      const matchRole =
        roleFilter === "ALL" ||
        emp.role === roleFilter ||
        (roleFilter === "OPERATOR" && emp.role === "DISPATCHER");

      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && emp.is_active) ||
        (statusFilter === "INACTIVE" && !emp.is_active);

      return matchSearch && matchRole && matchStatus;
    });
  }, [employees, searchQuery, roleFilter, statusFilter]);

  // Role Counts
  const adminCount = employees.filter((e) => e.role === "ADMIN" && e.is_active).length;
  const operatorCount = employees.filter(
    (e) => (e.role === "OPERATOR" || e.role === "DISPATCHER") && e.is_active
  ).length;
  const techCount = employees.filter((e) => e.role === "TECHNICIAN" && e.is_active).length;

  return (
    <div className="space-y-6">
      {/* ====================================================================
       * 1. SECTION HEADER
       * ==================================================================== */}
      <SectionHeader
        indexCode="MOD // 05 — УПРАВЛЕНИЕ ПЕРСОНАЛОМ"
        title="Служба безопасности и персонал"
        subtitle="Управление учётными записями дежурной смены, инженеров пожарной автоматики и операторов ситуационного центра FireGuard 360."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              codePrefix="SYNC"
              onClick={fetchEmployees}
              loading={loading}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Обновить штат
            </Button>
            <Button
              variant="primary"
              size="sm"
              codePrefix="ADD"
              onClick={handleOpenCreate}
            >
              <Plus className="w-3.5 h-3.5" />
              Добавить сотрудника
            </Button>
          </>
        }
      />

      {loading && <LoadingState message="Загрузка реестра сотрудников службы безопасности..." />}
      {!loading && error && <ErrorState message={error} onRetry={fetchEmployees} />}

      {/* ====================================================================
       * 2. ROLE COMPOSITION & ACCESS POLICY BANNER
       * ==================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
        <div className="border border-[#DCDAD4] bg-white p-4 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-[#8E8C84]">
            <span className="text-[10px] uppercase">АДМИНИСТРАТОРЫ (ADMIN)</span>
            <Shield className="w-4 h-4 text-[#D9531E]" />
          </div>
          <div className="text-2xl font-bold text-[#181816] tabular-nums">
            {adminCount}
          </div>
          <div className="text-[11px] text-[#5C5B56]">
            Полный доступ к настройкам и контурам
          </div>
        </div>

        <div className="border border-[#DCDAD4] bg-white p-4 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-[#8E8C84]">
            <span className="text-[10px] uppercase">ОПЕРАТОРЫ / ДИСПЕТЧЕРЫ</span>
            <Users className="w-4 h-4 text-[#181816]" />
          </div>
          <div className="text-2xl font-bold text-[#181816] tabular-nums">
            {operatorCount}
          </div>
          <div className="text-[11px] text-[#5C5B56]">
            Прием тревог, реагирование на инциденты
          </div>
        </div>

        <div className="border border-[#DCDAD4] bg-white p-4 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-[#8E8C84]">
            <span className="text-[10px] uppercase">ТЕХНИКИ (TECHNICIAN)</span>
            <UserCheck className="w-4 h-4 text-[#1F8844]" />
          </div>
          <div className="text-2xl font-bold text-[#181816] tabular-nums">
            {techCount}
          </div>
          <div className="text-[11px] text-[#5C5B56]">
            Поверка извещателей, ремонт и калибровка
          </div>
        </div>
      </div>

      {/* Architectural Security Note (Auth scope limitation notice per requirements) */}
      <div className="border border-[#DCDAD4] bg-[#EBEAE5]/60 p-4 font-mono text-xs space-y-1.5">
        <div className="flex items-center gap-2 text-[#5C5B56] font-semibold text-[11px]">
          <ShieldAlert className="w-4 h-4 text-[#D9531E]" />
          <span>ПОЛИТИКА БЕЗОПАСНОСТИ // ОГРАНИЧЕНИЯ ДОСТУПА</span>
        </div>
        <p className="text-[11px] text-[#181816] leading-relaxed font-sans">
          Все права и ролевые ограничения валидируются непосредственно на уровне backend API.
          Серверная логика запрещает деактивацию последнего администратора системы и блокирует
          несанкционированное повышение привилегий. Интеграция с внешними SSO/LDAP серверами
          вынесена за рамки хакатон-прототипа в соответствии с ТЗ.
        </p>
      </div>

      {/* ====================================================================
       * 3. SEARCH & ROLE FILTER BAR
       * ==================================================================== */}
      <div className="border border-[#DCDAD4] bg-white p-4 sm:p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCDAD4] pb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold uppercase text-[#181816]">
              РЕЕСТР ПЕРСОНАЛА СЛУЖБЫ БЕЗОПАСНОСТИ
            </span>
            <span className="font-mono text-xs text-[#8E8C84]">
              ({filteredEmployees.length} ИЗ {employees.length})
            </span>
          </div>

          {(searchQuery || roleFilter !== "ALL" || statusFilter !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setRoleFilter("ALL");
                setStatusFilter("ALL");
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
              placeholder="Поиск по ФИО, email или телефону..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-[#DCDAD4] focus:border-[#181816] text-xs font-mono focus:outline-none"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-[#DCDAD4] text-xs font-mono focus:outline-none"
          >
            <option value="ALL">Все роли сотрудников</option>
            <option value="ADMIN">ADMIN — Администратор системы</option>
            <option value="OPERATOR">OPERATOR / DISPATCHER — Диспетчер</option>
            <option value="TECHNICIAN">TECHNICIAN — Инженер / Техник ПБ</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-[#DCDAD4] text-xs font-mono focus:outline-none"
          >
            <option value="ALL">Все статусы аккаунтов</option>
            <option value="ACTIVE">Только активные сотрудники</option>
            <option value="INACTIVE">Деактивированные профили</option>
          </select>
        </div>
      </div>

      {/* ====================================================================
       * 4. EMPLOYEES LEDGER TABLE
       * ==================================================================== */}
      <div className="border border-[#DCDAD4] bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-sans">
            <thead>
              <tr className="border-b border-[#DCDAD4] bg-[#F5F4F0] font-mono text-[10px] text-[#5C5B56] uppercase">
                <th className="py-2.5 px-4">Сотрудник / ФИО</th>
                <th className="py-2.5 px-4">Роль в системе</th>
                <th className="py-2.5 px-4">Контакты (Email / Тел)</th>
                <th className="py-2.5 px-4">Связанные инциденты</th>
                <th className="py-2.5 px-4">Статус профиля</th>
                <th className="py-2.5 px-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCDAD4]">
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-[#F5F4F0]/60 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-[#181816] flex items-center gap-2">
                      <User className="w-4 h-4 text-[#8E8C84]" />
                      <span>{emp.full_name}</span>
                    </div>
                    <div className="font-mono text-[10px] text-[#8E8C84]">ID: #{emp.id}</div>
                  </td>

                  <td className="py-3 px-4 font-mono">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-[10px] border font-semibold ${
                        emp.role === "ADMIN"
                          ? "bg-[#FDECEC] border-[#C92A2A] text-[#A61B1B]"
                          : emp.role === "TECHNICIAN"
                          ? "bg-[#E9F5EE] border-[#1F8844] text-[#146330]"
                          : "bg-[#E8EEF5] border-[#3E506E] text-[#2A3952]"
                      }`}
                    >
                      {emp.role}
                    </span>
                  </td>

                  <td className="py-3 px-4 font-mono text-[11px] text-[#5C5B56] space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3 h-3 text-[#8E8C84]" />
                      <span>{emp.email}</span>
                    </div>
                    {emp.phone && (
                      <div className="flex items-center gap-1.5 text-[#181816]">
                        <Phone className="w-3 h-3 text-[#8E8C84]" />
                        <span>{emp.phone}</span>
                      </div>
                    )}
                  </td>

                  <td className="py-3 px-4 font-mono text-xs tabular-nums">
                    {emp.assigned_incidents_count > 0 ? (
                      <span className="font-semibold text-[#181816]">
                        {emp.assigned_incidents_count} инцид.
                      </span>
                    ) : (
                      <span className="text-[#8E8C84]">—</span>
                    )}
                  </td>

                  <td className="py-3 px-4 font-mono">
                    {emp.is_active ? (
                      <span className="inline-flex items-center gap-1 text-[#146330] bg-[#E9F5EE] border border-[#1F8844]/40 px-2 py-0.5 text-[10px]">
                        <span className="w-1.5 h-1.5 bg-[#1F8844]" /> АКТИВЕН
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[#5C5B56] bg-[#ECEEF0] border border-[#687076]/40 px-2 py-0.5 text-[10px]">
                        <span className="w-1.5 h-1.5 bg-[#8E8C84]" /> ОТКЛЮЧЕН
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleOpenEdit(emp)}
                    >
                      <Edit2 className="w-3 h-3" />
                      Редактировать
                    </Button>

                    {emp.is_active ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeactivate(emp)}
                        title="Деактивировать учетную запись"
                      >
                        <UserX className="w-3.5 h-3.5 text-[#C92A2A]" />
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleActivate(emp)}
                        title="Активировать учетную запись"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-[#1F8844]" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}

              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="max-w-md mx-auto space-y-2 font-mono text-xs">
                      <Users className="w-8 h-8 text-[#8E8C84] mx-auto" />
                      <div className="font-semibold text-[#181816]">СОТРУДНИКИ НЕ НАЙДЕНЫ</div>
                      <p className="text-[#5C5B56]">
                        По заданным критериям поиска профили персонала отсутствуют в базе
                        данных.
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
       * 5. CREATE / EDIT EMPLOYEE MODAL
       * ==================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#181816]/60 backdrop-blur-[1px] p-4">
          <div className="bg-white border border-[#DCDAD4] w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#DCDAD4] flex items-center justify-between bg-[#F5F4F0]">
              <div className="space-y-0.5">
                <span className="font-mono text-[10px] text-[#D9531E] uppercase">
                  {editingEmployee ? "РЕЖИМ РЕДАКТИРОВАНИЯ" : "РЕГИСТРАЦИЯ СОТРУДНИКА"}
                </span>
                <h3 className="text-base font-semibold text-[#181816]">
                  {editingEmployee
                    ? `Редактирование: ${editingEmployee.full_name}`
                    : "Добавление профиля персонала"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
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
            <form onSubmit={handleSubmitForm} className="p-5 space-y-4">
              <FieldInput
                label="Фамилия, Имя, Отчество"
                techCode="USER // NAME"
                placeholder="Например: Иванов Иван Иванович"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />

              <FieldInput
                label="Корпоративный Email"
                techCode="USER // EMAIL"
                type="text"
                placeholder="employee@fireguard.local"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                disabled={Boolean(editingEmployee)} // Email immutable on edit
                required
              />

              <FieldSelect
                label="Роль в системе безопасности"
                techCode="ROLE // PERMS"
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as UserRoleType)}
                options={[
                  { value: "OPERATOR", label: "OPERATOR — Диспетчер дежурной смены" },
                  { value: "TECHNICIAN", label: "TECHNICIAN — Инженер / Техник обслуживания" },
                  { value: "ADMIN", label: "ADMIN — Администратор системы" },
                ]}
              />

              <FieldInput
                label="Номер телефона для экстренной связи"
                techCode="TEL // MOBILE"
                placeholder="+7 (999) 000-00-00"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />

              <div className="pt-2 flex items-center justify-between border-t border-[#DCDAD4]">
                <label className="flex items-center gap-2 cursor-pointer font-mono text-xs">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="w-4 h-4 text-[#D9531E] border-[#DCDAD4] rounded"
                  />
                  <span>Учётная запись активна</span>
                </label>
              </div>

              <div className="pt-4 border-t border-[#DCDAD4] flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
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
                  {editingEmployee ? "Сохранить изменения" : "Зарегистрировать"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
