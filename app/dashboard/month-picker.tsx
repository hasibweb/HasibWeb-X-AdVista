'use client';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const currentMonth = new Date().toISOString().slice(0, 7);

function parseMonth(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) {
    const [year, month] = currentMonth.split('-').map(Number);
    return { year, month: month - 1 };
  }

  return { year: Number(match[1]), month: Number(match[2]) - 1 };
}

function formatMonthValue(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function formatMonthLabel(value: string) {
  const { year, month } = parseMonth(value);
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));
}

export function MonthPicker({
  value,
  onChange,
  className = '',
  ariaLabel = 'Select month',
  placement = 'bottom',
  maxMonth,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
  placement?: 'top' | 'bottom';
  maxMonth?: string;
}) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(parseMonth(value).year);
  const pickerRef = useRef<HTMLDivElement>(null);
  const activeMonth = useMemo(() => parseMonth(value), [value]);

  useEffect(() => {
    setViewYear(activeMonth.year);
  }, [activeMonth.year]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function selectMonth(month: number) {
    const nextMonth = formatMonthValue(viewYear, month);
    if (maxMonth && nextMonth > maxMonth) return;

    onChange(nextMonth);
    setOpen(false);
  }

  return (
    <div ref={pickerRef} className={`relative ${className}`}>
      <button
        type="button"
        className="focus-ring flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-md border border-slate-300 bg-white px-3 text-left text-sm shadow-sm transition hover:border-forest/50 hover:bg-slate-50"
        onClick={() => setOpen((current) => !current)}
        aria-label={ariaLabel}
        aria-expanded={open}
      >
        <span className="truncate">{formatMonthLabel(value)}</span>
        <CalendarDays size={17} className="shrink-0 text-slate-500" />
      </button>

      {open ? (
        <div
          className={`absolute left-0 z-50 w-[320px] rounded-lg border border-slate-200 bg-white p-3 shadow-[0_24px_70px_rgba(15,23,42,0.22)] ${
            placement === 'top' ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]'
          }`}
        >
          <div className="mb-3 flex items-center justify-between rounded-md bg-slate-50 px-2 py-1.5">
            <button
              type="button"
              className="focus-ring grid h-8 w-8 place-items-center rounded-md text-slate-600 hover:bg-white hover:text-ink"
              onClick={() => setViewYear((year) => year - 1)}
              aria-label="Previous year"
            >
              <ChevronLeft size={17} />
            </button>
            <span className="text-sm font-semibold text-ink">{viewYear}</span>
            <button
              type="button"
              className="focus-ring grid h-8 w-8 place-items-center rounded-md text-slate-600 hover:bg-white hover:text-ink"
              onClick={() => setViewYear((year) => year + 1)}
              aria-label="Next year"
            >
              <ChevronRight size={17} />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {monthNames.map((name, index) => {
              const active = activeMonth.year === viewYear && activeMonth.month === index;
              const disabled = Boolean(maxMonth && formatMonthValue(viewYear, index) > maxMonth);

              return (
                <button
                  key={name}
                  type="button"
                  className={`focus-ring h-10 rounded-md text-sm font-semibold transition ${
                    active
                      ? 'bg-forest text-white shadow-md shadow-emerald-950/15'
                      : disabled
                        ? 'cursor-not-allowed border border-slate-100 bg-slate-50 text-slate-300'
                      : 'border border-slate-200 bg-white text-slate-700 hover:border-forest/30 hover:bg-emerald-50 hover:text-forest'
                  }`}
                  onClick={() => selectMonth(index)}
                  disabled={disabled}
                >
                  {name}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <button
              type="button"
              className="focus-ring rounded-md px-2 py-1.5 text-sm font-semibold text-forest hover:bg-emerald-50"
              onClick={() => {
                onChange(currentMonth);
                setOpen(false);
              }}
              disabled={Boolean(maxMonth && currentMonth > maxMonth)}
            >
              This month
            </button>
            <button type="button" className="focus-ring rounded-md px-2 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-50" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
