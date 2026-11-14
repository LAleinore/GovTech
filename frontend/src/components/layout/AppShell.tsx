import React, { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Box,
  ClipboardList,
  Compass,
  Layers,
  Menu,
  ShieldAlert,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { StatusSignal } from "../ui/Primitives";

export interface NavItem {
  index: string;
  code: string;
  label: string;
  sublabel: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export const NAVIGATION_ITEMS: NavItem[] = [
  {
    index: "01",
    code: "SYS // CMD",
    label: "Ситуационный центр",
    sublabel: "Сводка объекта и контуров",
    path: "/",
    icon: Compass,
  },
  {
    index: "02",
    code: "TWIN // 3D",
    label: "3D Модель здания",
    sublabel: "Поэтажный цифровой двойник",
    path: "/digital-twin",
    icon: Box,
  },
  {
    index: "03",
    code: "TEL // LIVE",
    label: "Мониторинг датчиков",
    sublabel: "Телеметрия в реальном времени",
    path: "/monitoring",
    icon: Activity,
  },
  {
    index: "04",
    code: "ALM // INC",
    label: "Тревоги и инциденты",
    sublabel: "Очередь реагирования и разбор",
    path: "/incidents",
    icon: AlertTriangle,
  },
  {
    index: "05",
    code: "MNT // OPS",
    label: "Техобслуживание",
    sublabel: "Регламенты и поверка узлов",
    path: "/maintenance",
    icon: Wrench,
  },
  {
    index: "06",
    code: "LOG // ANL",
    label: "Аналитика и журнал",
    sublabel: "Хронология событий и тренды",
    path: "/analytics",
    icon: ClipboardList,
  },
  {
    index: "07",
    code: "USR // SEC",
    label: "Персонал и доступ",
    sublabel: "Служба безопасности и техники",
    path: "/personnel",
    icon: Users,
  },
  {
    index: "00",
    code: "DSG // UI",
    label: "Инженерный UI-кит",
    sublabel: "Эталон стилей и компонентов",
    path: "/ui-system",
    icon: Layers,
  },
];

interface AppShellProps {
  buildingName?: string;
  buildingCode?: string;
  apiConnected?: boolean;
  demoMode?: boolean;
  sensorCount?: number;
  simulationSlot?: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  buildingName = "Инженерно-лабораторный корпус Alpha",
  buildingCode = "BLD-ALPHA",
  apiConnected = true,
  demoMode = true,
  sensorCount = 3,
  simulationSlot,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const currentNav =
    NAVIGATION_ITEMS.find((item) =>
      item.path === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(item.path)
    ) || NAVIGATION_ITEMS[0];

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F4F0] text-[#181816] selection:bg-[#D9531E] selection:text-white">
      {/* ====================================================================
       * TOP ENGINEERING TELEMETRY HEADER
       * ==================================================================== */}
      <header className="sticky top-0 z-40 h-14 bg-white border-b border-[#DCDAD4] px-4 lg:px-6 flex items-center justify-between gap-4">
        {/* Left: Brand & Mobile Trigger */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 border border-[#DCDAD4] text-[#181816] hover:bg-[#EBEAE5]"
            aria-label="Переключить меню навигации"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#181816] text-white flex items-center justify-center font-mono text-xs font-bold tracking-tighter border border-[#181816]">
              FG
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold tracking-tight text-sm uppercase">
                  FireGuard 360
                </span>
                <span className="hidden sm:inline-block font-mono text-[10px] text-[#8E8C84] border border-[#DCDAD4] px-1.5 py-0.2">
                  REV 26.1
                </span>
              </div>
              <p className="font-mono text-[10px] text-[#5C5B56] tracking-wider uppercase hidden sm:block">
                ARCHITECTURAL DIGITAL TWIN // SAFETY PLATFORM
              </p>
            </div>
          </div>
        </div>

        {/* Center: Active Facility Coordinates & Breadcrumb */}
        <div className="hidden md:flex items-center gap-6 border-x border-[#DCDAD4] px-6 h-full text-xs">
          <div>
            <span className="font-mono text-[10px] text-[#8E8C84] block uppercase">
              ОБЪЕКТ МОНИТОРИНГА
            </span>
            <div className="flex items-center gap-2 font-medium text-[#181816]">
              <span className="font-mono text-xs text-[#D9531E]">{buildingCode}</span>
              <span>—</span>
              <span className="truncate max-w-[220px]">{buildingName}</span>
            </div>
          </div>

          <div className="h-6 w-[1px] bg-[#DCDAD4]" />

          <div>
            <span className="font-mono text-[10px] text-[#8E8C84] block uppercase">
              АКТИВНЫЙ РАЗДЕЛ
            </span>
            <span className="font-mono text-xs text-[#181816]">
              [{currentNav.index}] {currentNav.label}
            </span>
          </div>
        </div>

        {/* Right: System Telemetry & Demo Mode Status */}
        <div className="flex items-center gap-2.5">
          <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 bg-[#F5F4F0] border border-[#DCDAD4] font-mono text-[11px]">
            <span className="text-[#5C5B56]">УЗЛОВ:</span>
            <span className="font-semibold text-[#181816] tabular-nums">{sensorCount}</span>
          </div>

          <StatusSignal
            status={apiConnected ? "NORMAL" : "OFFLINE"}
            label={apiConnected ? "ШИНА АКТИВНА" : "АВТОНОМНЫЙ РЕЖИМ"}
          />

          {demoMode && <StatusSignal status="DEMO" label="DEMO MODE" />}
        </div>
      </header>

      {/* ====================================================================
       * MAIN WORKSPACE BODY (SIDEBAR RAIL + CONTENT AREA)
       * ==================================================================== */}
      <div className="flex-1 flex relative">
        {/* Mobile Backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-30 bg-[#181816]/40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Left Architectural Navigation Rail */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-30 w-72 bg-white border-r border-[#DCDAD4] flex flex-col justify-between transition-transform duration-200 ease-out pt-14 lg:pt-0 ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          {/* Navigation List */}
          <div className="p-4 space-y-6 overflow-y-auto">
            <div>
              <div className="px-2 pb-2 mb-2 border-b border-[#DCDAD4] flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#8E8C84]">
                  ИНЖЕНЕРНЫЕ МОДУЛИ
                </span>
                <span className="font-mono text-[10px] text-[#8E8C84]">[01–06]</span>
              </div>

              <nav className="space-y-1" aria-label="Основная навигация">
                {NAVIGATION_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === "/"}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `group flex items-start gap-3 px-3 py-2.5 border-l-2 transition-colors ${
                          isActive
                            ? "border-l-[#D9531E] bg-[#F5F4F0] text-[#181816]"
                            : "border-l-transparent text-[#5C5B56] hover:bg-[#F5F4F0]/60 hover:text-[#181816]"
                        }`
                      }
                    >
                      <span className="font-mono text-[11px] text-[#8E8C84] group-hover:text-[#D9531E] pt-0.5 tabular-nums">
                        {item.index}
                      </span>
                      <Icon className="w-4 h-4 mt-0.5 shrink-0 text-[#5C5B56] group-hover:text-[#181816]" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold tracking-tight truncate">
                            {item.label}
                          </span>
                          <span className="font-mono text-[9px] text-[#8E8C84]">
                            {item.code.split(" // ")[1]}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#8E8C84] truncate mt-0.5">
                          {item.sublabel}
                        </p>
                      </div>
                    </NavLink>
                  );
                })}
              </nav>
            </div>

            {/* Facility Quick Spec Box */}
            <div className="border border-[#DCDAD4] bg-[#F5F4F0] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between border-b border-[#DCDAD4] pb-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#5C5B56]">
                  ПАСПОРТ КОНТУРА
                </span>
                <ShieldAlert className="w-3.5 h-3.5 text-[#D9531E]" />
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                <div>
                  <span className="text-[#8E8C84] block text-[9px]">КОД ЗДАНИЯ</span>
                  <span className="text-[#181816] font-medium">{buildingCode}</span>
                </div>
                <div>
                  <span className="text-[#8E8C84] block text-[9px]">СИСТЕМА КООРД.</span>
                  <span className="text-[#181816] font-medium">METRIC [X,Y,Z]</span>
                </div>
                <div>
                  <span className="text-[#8E8C84] block text-[9px]">ПРОТОКОЛ</span>
                  <span className="text-[#181816] font-medium">REST + WS</span>
                </div>
                <div>
                  <span className="text-[#8E8C84] block text-[9px]">РЕЖИМ ДАННЫХ</span>
                  <span className="text-[#D9531E] font-medium">
                    {demoMode ? "DEMO SIM" : "LIVE"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Technical Footer */}
          <div className="p-4 border-t border-[#DCDAD4] bg-[#EBEAE5]/50 font-mono text-[10px] text-[#5C5B56] space-y-1">
            <div className="flex items-center justify-between">
              <span>FIREGUARD 360 ENGINE</span>
              <span className="text-[#1F8844]">● READY</span>
            </div>
            <div className="text-[#8E8C84]">
              НЕ ЯВЛЯЕТСЯ СЕРТИФИЦИРОВАННЫМ ПРИБОРОМ ППКП (ДЕМО-ПРОТОТИП)
            </div>
          </div>
        </aside>

        {/* Main Content Canvas */}
        <main className="flex-1 min-w-0 bg-engineering-grid p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          <div className="max-w-[1600px] mx-auto space-y-6">
            {simulationSlot}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

