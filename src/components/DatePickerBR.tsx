import React, { useState, useEffect, useRef } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Check } from "lucide-react";

interface DatePickerBRProps {
  value: string; // Expected format: YYYY-MM-DD or empty
  onChange: (value: string) => void; // Emits YYYY-MM-DD or empty
  required?: boolean;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const DAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function DatePickerBR({
  value,
  onChange,
  required = false,
  className = "",
  placeholder = "DD/MM/AAAA",
  disabled = false
}: DatePickerBRProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Calendar view state
  const [viewYear, setViewYear] = useState<number>(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(new Date().getMonth()); // 0-11

  // Convert YYYY-MM-DD to DD/MM/YYYY for display
  const isoToBr = (isoStr: string): string => {
    if (!isoStr || !/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return "";
    const [y, m, d] = isoStr.split("-");
    return `${d}/${m}/${y}`;
  };

  // Convert DD/MM/YYYY to YYYY-MM-DD
  const brToIso = (brStr: string): string => {
    if (!brStr || brStr.length !== 10) return "";
    const [d, m, y] = brStr.split("/");
    if (!d || !m || !y || y.length !== 4) return "";
    const dayNum = parseInt(d, 10);
    const monthNum = parseInt(m, 10);
    const yearNum = parseInt(y, 10);
    if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12 || yearNum < 1900 || yearNum > 2100) return "";
    return `${yearNum}-${monthNum.toString().padStart(2, "0")}-${dayNum.toString().padStart(2, "0")}`;
  };

  // Sync inputText when value prop changes externally
  useEffect(() => {
    setInputText(isoToBr(value));
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m] = value.split("-").map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    }
  }, [value]);

  // Handle outside click to close popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Format typing with slashes (e.g., 11082026 -> 11/08/2026)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    let formatted = raw;
    if (raw.length > 2 && raw.length <= 4) {
      formatted = `${raw.slice(0, 2)}/${raw.slice(2)}`;
    } else if (raw.length > 4) {
      formatted = `${raw.slice(0, 2)}/${raw.slice(2, 4)}/${raw.slice(4, 8)}`;
    }
    setInputText(formatted);

    if (formatted.length === 10) {
      const iso = brToIso(formatted);
      if (iso) {
        onChange(iso);
        const [y, m] = iso.split("-").map(Number);
        setViewYear(y);
        setViewMonth(m - 1);
      }
    } else if (formatted.length === 0) {
      onChange("");
    }
  };

  // Calendar navigation
  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const selectDate = (day: number) => {
    const mStr = (viewMonth + 1).toString().padStart(2, "0");
    const dStr = day.toString().padStart(2, "0");
    const iso = `${viewYear}-${mStr}-${dStr}`;
    onChange(iso);
    setInputText(`${dStr}/${mStr}/${viewYear}`);
    setIsOpen(false);
  };

  const selectToday = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    const mStr = (m + 1).toString().padStart(2, "0");
    const dStr = d.toString().padStart(2, "0");
    const iso = `${y}-${mStr}-${dStr}`;
    setViewYear(y);
    setViewMonth(m);
    onChange(iso);
    setInputText(`${dStr}/${mStr}/${y}`);
    setIsOpen(false);
  };

  const clearSelection = () => {
    onChange("");
    setInputText("");
    setIsOpen(false);
  };

  // Generate grid cells for calendar
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfWeek = (year: number, month: number) => {
    return new Date(year, month, 1).getDay(); // 0 = Sunday
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDayOfWeek = getFirstDayOfWeek(viewYear, viewMonth);
  const prevMonthDays = getDaysInMonth(viewYear, viewMonth === 0 ? 11 : viewMonth - 1);

  // Selected components
  const selectedYear = value ? parseInt(value.split("-")[0], 10) : null;
  const selectedMonth = value ? parseInt(value.split("-")[1], 10) - 1 : null;
  const selectedDay = value ? parseInt(value.split("-")[2], 10) : null;

  const today = new Date();
  const isToday = (day: number) => {
    return today.getFullYear() === viewYear &&
           today.getMonth() === viewMonth &&
           today.getDate() === day;
  };

  const isSelected = (day: number) => {
    return selectedYear === viewYear &&
           selectedMonth === viewMonth &&
           selectedDay === day;
  };

  // Generate years list for dropdown (-10 to +10 years)
  const currentYr = new Date().getFullYear();
  const yearsList = Array.from({ length: 21 }, (_, i) => currentYr - 10 + i);

  return (
    <div ref={containerRef} className="relative w-full inline-block">
      {/* Text Input with BR Mask and Calendar Icon */}
      <div className="relative flex items-center">
        <input
          type="text"
          required={required}
          disabled={disabled}
          value={inputText}
          onChange={handleInputChange}
          onClick={() => !disabled && setIsOpen(true)}
          placeholder={placeholder}
          maxLength={10}
          className={className || "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#859159] pr-10"}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className="absolute right-2 text-slate-400 hover:text-[#859159] p-1 transition cursor-pointer"
          title="Abrir calendário em Português"
        >
          <CalendarIcon size={16} className="text-[#859159]" />
        </button>
      </div>

      {/* 100% Portuguese Calendar Popover */}
      {isOpen && (
        <div className="absolute left-0 mt-1 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-3.5 w-72 text-slate-800 animate-fadeIn">
          {/* Header Controls */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition"
              title="Mês Anterior"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="flex items-center gap-1">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
                className="text-xs font-bold bg-transparent text-[#424733] border-none focus:outline-none cursor-pointer"
              >
                {MONTHS_PT.map((m, idx) => (
                  <option key={m} value={idx}>{m}</option>
                ))}
              </select>

              <select
                value={viewYear}
                onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
                className="text-xs font-bold bg-transparent text-[#424733] border-none focus:outline-none cursor-pointer"
              >
                {yearsList.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition"
              title="Próximo Mês"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Days of Week Header (Portuguese) */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {DAYS_PT.map(d => (
              <span key={d} className="text-[10px] font-bold uppercase text-slate-400">
                {d}
              </span>
            ))}
          </div>

          {/* Calendar Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {/* Previous month padding days */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => {
              const prevDay = prevMonthDays - firstDayOfWeek + idx + 1;
              return (
                <span key={`prev-${idx}`} className="py-1 text-slate-300 pointer-events-none">
                  {prevDay}
                </span>
              );
            })}

            {/* Current month days */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const active = isSelected(day);
              const todayMark = isToday(day);

              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  onClick={() => selectDate(day)}
                  className={`py-1.5 rounded-lg font-semibold transition cursor-pointer text-xs ${
                    active
                      ? "bg-[#859159] text-white font-bold shadow-sm"
                      : todayMark
                      ? "border border-[#859159] text-[#859159] font-bold bg-[#859159]/10"
                      : "hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer Action Buttons (100% Portuguese) */}
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100 text-xs font-semibold">
            <button
              type="button"
              onClick={selectToday}
              className="text-[#859159] hover:text-[#424733] transition"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="text-slate-400 hover:text-rose-600 transition"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
