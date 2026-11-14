import React from "react";

/* ============================================================================
 * 1. STATUS SIGNAL / TECHNICAL BADGE
 * ============================================================================ */
export type SignalVariant = "NORMAL" | "WARNING" | "ALARM" | "FAULT" | "OFFLINE" | "DEMO";

interface StatusSignalProps {
  status: SignalVariant;
  label?: string;
  pulse?: boolean;
}

const SIGNAL_STYLES: Record<
  SignalVariant,
  { bg: string; border: string; text: string; dot: string; defaultLabel: string }
> = {
  NORMAL: {
    bg: "bg-[#E9F5EE]",
    border: "border-[#1F8844]/40",
    text: "text-[#146330]",
    dot: "bg-[#1F8844]",
    defaultLabel: "НОРМА",
  },
  WARNING: {
    bg: "bg-[#FDF3E7]",
    border: "border-[#D9822B]/45",
    text: "text-[#9C540D]",
    dot: "bg-[#D9822B]",
    defaultLabel: "ВНИМАНИЕ",
  },
  ALARM: {
    bg: "bg-[#FDECEC]",
    border: "border-[#C92A2A]/50",
    text: "text-[#A61B1B]",
    dot: "bg-[#C92A2A]",
    defaultLabel: "ТРЕВОГА",
  },
  FAULT: {
    bg: "bg-[#ECEEF0]",
    border: "border-[#687076]/40",
    text: "text-[#495057]",
    dot: "bg-[#687076]",
    defaultLabel: "НЕИСПРАВНОСТЬ",
  },
  OFFLINE: {
    bg: "bg-[#EBEAE5]",
    border: "border-[#8C8A84]/40",
    text: "text-[#5C5B56]",
    dot: "bg-[#8E8C84]",
    defaultLabel: "НЕТ СВЯЗИ",
  },
  DEMO: {
    bg: "bg-[#E8EEF5]",
    border: "border-[#3E506E]/40",
    text: "text-[#2A3952]",
    dot: "bg-[#3E506E]",
    defaultLabel: "DEMO MODE",
  },
};

export const StatusSignal: React.FC<StatusSignalProps> = ({ status, label, pulse }) => {
  const cfg = SIGNAL_STYLES[status] || SIGNAL_STYLES.NORMAL;
  return (
    <span
      className={`inline-flex items-center gap-2 px-2.5 py-0.5 border text-[11px] font-mono font-semibold tracking-wider uppercase ${cfg.bg} ${cfg.border} ${cfg.text}`}
    >
      <span
        className={`w-1.5 h-1.5 ${cfg.dot} ${
          pulse || status === "ALARM" ? "animate-ping" : ""
        }`}
      />
      <span>{label ?? cfg.defaultLabel}</span>
    </span>
  );
};

/* ============================================================================
 * 2. INDUSTRIAL BUTTON
 * ============================================================================ */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  codePrefix?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  codePrefix,
  className = "",
  disabled,
  ...props
}) => {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium transition-colors border focus:outline-none focus:ring-2 focus:ring-[#D9531E]/40 disabled:opacity-50 disabled:cursor-not-allowed select-none";

  const variants = {
    primary:
      "bg-[#D9531E] hover:bg-[#BA4214] text-white border-[#D9531E]",
    secondary:
      "bg-white hover:bg-[#EBEAE5] text-[#181816] border-[#8C8A84]",
    danger:
      "bg-[#C92A2A] hover:bg-[#A61B1B] text-white border-[#C92A2A]",
    ghost:
      "bg-transparent hover:bg-[#EBEAE5] text-[#181816] border-transparent hover:border-[#DCDAD4]",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-xs tracking-wide uppercase",
    lg: "px-5 py-2.5 text-sm tracking-wide uppercase",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {codePrefix && (
        <span className="font-mono text-[10px] opacity-75 border-r border-current/30 pr-2">
          {codePrefix}
        </span>
      )}
      {loading ? (
        <span className="inline-flex items-center gap-2 font-mono text-xs">
          <span className="w-2 h-2 bg-current animate-pulse" />
          ВЫПОЛНЕНИЕ...
        </span>
      ) : (
        children
      )}
    </button>
  );
};

/* ============================================================================
 * 3. ENGINEERING INPUT & SELECT FIELDS
 * ============================================================================ */
interface FieldInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  techCode?: string;
  error?: string;
  unit?: string;
}

export const FieldInput: React.FC<FieldInputProps> = ({
  label,
  techCode,
  error,
  unit,
  className = "",
  ...props
}) => {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <label className="font-medium text-[#181816] uppercase tracking-wider text-[11px]">
          {label}
        </label>
        {techCode && (
          <span className="font-mono text-[10px] text-[#8E8C84]">{techCode}</span>
        )}
      </div>
      <div className="relative flex items-center">
        <input
          className={`w-full bg-white border ${
            error ? "border-[#C92A2A]" : "border-[#DCDAD4] focus:border-[#181816]"
          } px-3 py-2 text-sm text-[#181816] placeholder:text-[#8E8C84] focus:outline-none transition-colors ${
            unit ? "pr-12" : ""
          } ${className}`}
          {...props}
        />
        {unit && (
          <span className="absolute right-3 font-mono text-xs text-[#5C5B56] pointer-events-none">
            {unit}
          </span>
        )}
      </div>
      {error && (
        <span className="font-mono text-[11px] text-[#C92A2A]">ERR // {error}</span>
      )}
    </div>
  );
};

interface FieldSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  techCode?: string;
  options: { value: string; label: string }[];
}

export const FieldSelect: React.FC<FieldSelectProps> = ({
  label,
  techCode,
  options,
  className = "",
  ...props
}) => {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <label className="font-medium text-[#181816] uppercase tracking-wider text-[11px]">
          {label}
        </label>
        {techCode && (
          <span className="font-mono text-[10px] text-[#8E8C84]">{techCode}</span>
        )}
      </div>
      <select
        className={`w-full bg-white border border-[#DCDAD4] focus:border-[#181816] px-3 py-2 text-sm text-[#181816] focus:outline-none transition-colors ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

/* ============================================================================
 * 4. UNIFIED LOADING & ERROR STATES
 * ============================================================================ */
interface LoadingStateProps {
  message?: string;
  code?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = "Синхронизация телеметрии и контуров объекта...",
  code = "SYNC // IO-WAIT",
}) => {
  return (
    <div className="w-full border border-[#DCDAD4] bg-white p-8 flex flex-col items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-2.5 h-2.5 bg-[#D9531E] animate-ping" />
        <span className="font-mono text-xs uppercase tracking-widest text-[#5C5B56]">
          {code}
        </span>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-[#181816]">{message}</p>
        <p className="font-mono text-xs text-[#8E8C84]">
          Ожидание ответа от шины данных FireGuard 360...
        </p>
      </div>
      <div className="w-full h-1 bg-[#EBEAE5] overflow-hidden">
        <div className="w-1/3 h-full bg-[#D9531E] animate-pulse" />
      </div>
    </div>
  );
};

interface ErrorStateProps {
  title?: string;
  message: string;
  code?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Ошибка обмена данными с контуром мониторинга",
  message,
  code = "ERR // COMM-FAIL",
  onRetry,
}) => {
  return (
    <div className="w-full border-l-4 border-l-[#C92A2A] border border-[#DCDAD4] bg-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-[#C92A2A] uppercase tracking-wider">
            {code}
          </span>
          <span className="text-[#DCDAD4]">|</span>
          <span className="text-xs font-mono text-[#5C5B56]">ДИАГНОСТИКА КАНАЛА</span>
        </div>
        <h3 className="text-base font-semibold text-[#181816]">{title}</h3>
        <p className="text-xs font-mono text-[#5C5B56]">{message}</p>
      </div>
      {onRetry && (
        <div className="shrink-0">
          <Button variant="secondary" size="sm" codePrefix="RETRY" onClick={onRetry}>
            Повторить запрос
          </Button>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 5. EDITORIAL SECTION HEADER
 * ============================================================================ */
interface SectionHeaderProps {
  indexCode: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  indexCode,
  title,
  subtitle,
  actions,
}) => {
  return (
    <div className="border-b border-[#DCDAD4] pb-5 mb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 font-mono text-xs text-[#D9531E] tracking-widest uppercase">
          <span>{indexCode}</span>
          <span className="text-[#DCDAD4]">—</span>
          <span className="text-[#5C5B56]">FIREGUARD ARCHITECTURAL TWIN</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#181816]">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-[#5C5B56] max-w-2xl">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2.5 flex-wrap">{actions}</div>}
    </div>
  );
};

