import React from 'react';
import type { SkillType } from '../types/foco';
import { formatHoursMinutes } from '../utils/analytics';

const SKILL_COLORS: Record<SkillType, string> = {
  Speaking: '#0D9488',
  Listening: '#2563EB',
  Reading: '#0284C7',
  Vocabulary: '#D97706',
  Grammar: '#7C3AED',
  Writing: '#DC2626',
  Pronunciation: '#059669',
  Immersion: '#4F46E5',
};

interface SkillBreakdownItem {
  skill: SkillType;
  seconds: number;
  hours: number;
  percent: number;
}

interface MonthlyPoint {
  monthKey: string;
  label: string;
  totalHours: number;
  speakingHours: number;
}

export const SkillPieChart: React.FC<{ data: SkillBreakdownItem[] }> = ({ data }) => {
  const active = data.filter((d) => d.seconds > 0);
  const totalSec = active.reduce((acc, d) => acc + d.seconds, 0);

  if (totalSec === 0) {
    return (
      <div className="flex h-52 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        Log study time to visualize skill distribution.
      </div>
    );
  }

  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  let offsetAcc = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative h-44 w-44 shrink-0">
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="22"
            className="text-slate-100 dark:text-slate-800"
          />
          {active.map((item) => {
            const frac = item.seconds / totalSec;
            const dash = frac * circumference;
            const currentOffset = offsetAcc;
            offsetAcc += dash;
            return (
              <circle
                key={item.skill}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={SKILL_COLORS[item.skill]}
                strokeWidth="22"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-currentOffset}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {formatHoursMinutes(totalSec)}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">Total Logged</span>
        </div>
      </div>

      <div className="grid w-full grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
        {active.map((item) => (
          <div key={item.skill} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: SKILL_COLORS[item.skill] }}
              />
              <span className="truncate text-slate-700 dark:text-slate-300">{item.skill}</span>
            </div>
            <span className="font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {item.percent}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const SkillBarChart: React.FC<{ data: SkillBreakdownItem[] }> = ({ data }) => {
  const maxSeconds = Math.max(1, ...data.map((d) => d.seconds));

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const widthPct = item.seconds > 0 ? Math.max(3, Math.round((item.seconds / maxSeconds) * 100)) : 0;
        return (
          <div key={item.skill} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-800 dark:text-slate-200">{item.skill}</span>
              <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                {formatHoursMinutes(item.seconds)} · {item.percent}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-md transition-all duration-300"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: SKILL_COLORS[item.skill],
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const MonthlyTrendChart: React.FC<{ data: MonthlyPoint[] }> = ({ data }) => {
  const maxHours = Math.max(5, ...data.map((d) => d.totalHours));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" /> Total Hours
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-teal-500" /> Speaking Focus
          </span>
        </div>
        <span className="font-mono tabular-nums">Max {maxHours.toFixed(1)}h</span>
      </div>

      <div className="grid grid-cols-6 gap-2 sm:gap-4 items-end h-44 pt-4 border-b border-slate-200 dark:border-slate-800">
        {data.map((pt) => {
          const totalH = Math.round((pt.totalHours / maxHours) * 100);
          const speakH = Math.round((pt.speakingHours / maxHours) * 100);
          return (
            <div key={pt.monthKey} className="flex flex-col items-center justify-end h-full gap-1.5">
              <span className="font-mono text-[11px] tabular-nums text-slate-600 dark:text-slate-400">
                {pt.totalHours > 0 ? `${pt.totalHours}h` : '0h'}
              </span>
              <div className="flex items-end gap-1 w-full justify-center h-28">
                <div
                  className="w-3 sm:w-4 rounded-t-sm bg-blue-600/85 dark:bg-blue-500/85 transition-all"
                  style={{ height: `${Math.max(pt.totalHours > 0 ? 6 : 2, totalH)}%` }}
                  title={`${pt.label} total: ${pt.totalHours}h`}
                />
                <div
                  className="w-3 sm:w-4 rounded-t-sm bg-teal-500 transition-all"
                  style={{ height: `${Math.max(pt.speakingHours > 0 ? 6 : 2, speakH)}%` }}
                  title={`${pt.label} speaking: ${pt.speakingHours}h`}
                />
              </div>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 pb-1">
                {pt.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
