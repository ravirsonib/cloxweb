import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Activity, BarChart3, Check, ChevronDown, PieChart, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ChartVisualType = 'bar' | 'line' | 'area' | 'pie';

export type ChartDataItem = {
  id: string;
  label: string;
  value: number;
  secondaryValue?: number;
  color?: string;
};

// Clox Orange & Blue brand palette
const CHART_PALETTE = [
  '#f97316', // Clox Orange
  '#0284c7', // Sky Blue
  '#ea580c', // Deep Orange
  '#2563eb', // Royal Blue
  '#fb923c', // Sunset Light Orange
  '#1d4ed8', // Deep Navy Blue
  '#fdba74', // Soft Peach Orange
  '#38bdf8', // Light Sky Blue
];

const VISUAL_CONFIG: Record<
  ChartVisualType,
  { label: string; icon: typeof BarChart3 }
> = {
  bar: { label: 'Bar Chart', icon: BarChart3 },
  line: { label: 'Line Chart', icon: TrendingUp },
  area: { label: 'Area Trend', icon: Activity },
  pie: { label: 'Donut / Pie', icon: PieChart },
};

function ChartVisualDropdown({
  visual,
  onSelect,
  allowedVisuals,
}: {
  visual: ChartVisualType;
  onSelect: (v: ChartVisualType) => void;
  allowedVisuals: ChartVisualType[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const CurrentIcon = VISUAL_CONFIG[visual]?.icon ?? BarChart3;

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-clox-border bg-clox-surface px-2.5 py-1 text-xs font-semibold text-clox-ink shadow-sm transition hover:border-clox-orange hover:bg-clox-surface-alt/60 focus:border-clox-orange focus:outline-none focus:ring-1 focus:ring-clox-orange"
        aria-expanded={isOpen}
      >
        <CurrentIcon className="h-3.5 w-3.5 text-clox-orange" />
        <span>{VISUAL_CONFIG[visual]?.label}</span>
        <ChevronDown
          className={cn(
            'h-3 w-3 text-clox-mute transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-30 mt-1.5 w-40 origin-top-right rounded-xl border border-clox-border bg-clox-surface p-1 shadow-lg ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150">
          <div className="space-y-0.5">
            {allowedVisuals.map((opt) => {
              const Icon = VISUAL_CONFIG[opt]?.icon ?? BarChart3;
              const isSelected = visual === opt;
              return (
                <button
                  type="button"
                  key={opt}
                  onClick={() => {
                    onSelect(opt);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition',
                    isSelected
                      ? 'bg-clox-orange/10 font-bold text-clox-orange'
                      : 'text-clox-ink hover:bg-clox-surface-alt hover:text-clox-orange',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      className={cn(
                        'h-3.5 w-3.5',
                        isSelected ? 'text-clox-orange' : 'text-clox-mute',
                      )}
                    />
                    <span>{VISUAL_CONFIG[opt]?.label}</span>
                  </div>
                  {isSelected ? <Check className="h-3 w-3 text-clox-orange" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Animated counter hook that smoothly counts up to target value with cubic easing.
 */
export function useAnimatedNumber(target: number, durationMs = 700): number {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    const startValue = current;
    const diff = target - startValue;

    if (diff === 0) return;

    let frameId: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / durationMs, 1);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const nextVal = startValue + diff * ease;
      const isIntegerTarget = Number.isInteger(target);
      setCurrent(isIntegerTarget ? Math.round(nextVal) : Math.round(nextVal * 100) / 100);

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        setCurrent(target);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [target, durationMs]);

  return current;
}

export function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  formatter,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  formatter?: (n: number) => string;
  className?: string;
}) {
  const animated = useAnimatedNumber(value);
  const formatted = formatter ? formatter(animated) : animated.toLocaleString();
  return (
    <span className={cn('tabular-nums transition-colors', className)}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

export function InteractiveChart({
  title,
  subtitle,
  items,
  defaultVisual = 'bar',
  allowedVisuals = ['bar', 'line', 'area', 'pie'],
  valuePrefix = '',
  valueSuffix = '',
  formatValue,
  badge,
  className,
}: {
  title: string;
  subtitle?: string;
  items: ChartDataItem[];
  defaultVisual?: ChartVisualType;
  allowedVisuals?: ChartVisualType[];
  valuePrefix?: string;
  valueSuffix?: string;
  formatValue?: (val: number) => string;
  badge?: ReactNode;
  className?: string;
}) {
  const chartId = useId();
  const [visual, setVisual] = useState<ChartVisualType>(defaultVisual);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const displayFormatter = useMemo(() => {
    if (formatValue) return formatValue;
    return (n: number) => `${valuePrefix}${n.toLocaleString()}${valueSuffix}`;
  }, [formatValue, valuePrefix, valueSuffix]);

  const totalValue = useMemo(
    () => items.reduce((acc, item) => acc + (item.value || 0), 0),
    [items],
  );

  const maxValue = useMemo(
    () => Math.max(1, ...items.map((item) => item.value || 0)),
    [items],
  );

  const activeItem = hoveredIndex !== null ? items[hoveredIndex] : null;

  return (
    <div className={cn('clox-card flex flex-col p-5 transition-all duration-300', className)}>
      {/* Scoped CSS keyframe animations for rich chart motion */}
      <style>{`
        @keyframes cloxDrawLine {
          from {
            stroke-dashoffset: 1400;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes cloxBarGrow {
          from {
            transform: scaleY(0);
            opacity: 0.1;
          }
          to {
            transform: scaleY(1);
            opacity: 1;
          }
        }
        @keyframes cloxPopIn {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          70% {
            transform: scale(1.3);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes cloxSlicePop {
          0% {
            transform: scale(0.65) rotate(-20deg);
            opacity: 0;
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
        @keyframes cloxAreaRise {
          from {
            opacity: 0;
            transform: scaleY(0.7);
          }
          to {
            opacity: 1;
            transform: scaleY(1);
          }
        }
        @keyframes cloxRadarPulse {
          0% {
            r: 6;
            opacity: 0.8;
          }
          100% {
            r: 16;
            opacity: 0;
          }
        }
      `}</style>

      {/* Header with Title and Theme-styled Visual Switcher Dropdown */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-clox-border-soft pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg font-bold text-clox-ink">{title}</h3>
            {badge}
          </div>
          {subtitle ? <p className="mt-0.5 text-xs text-clox-mute">{subtitle}</p> : null}
        </div>

        {/* Visual Switcher custom theme dropdown */}
        <div className="flex items-center gap-2">
          <ChartVisualDropdown
            visual={visual}
            onSelect={setVisual}
            allowedVisuals={allowedVisuals}
          />
        </div>
      </div>

      {/* Main Chart Canvas Area (re-animates on visual or length change) */}
      <div
        key={`${visual}-${items.length}`}
        className="relative mt-4 flex min-h-[240px] flex-1 flex-col justify-center"
      >
        {items.length === 0 || totalValue === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center text-center text-clox-faint">
            <Activity className="h-8 w-8 stroke-[1.5] text-clox-mute/50" />
            <p className="mt-2 text-sm">No activity recorded for this period</p>
          </div>
        ) : visual === 'pie' ? (
          <PieDonutView
            items={items}
            totalValue={totalValue}
            hoveredIndex={hoveredIndex}
            onHover={setHoveredIndex}
            formatter={displayFormatter}
          />
        ) : visual === 'line' || visual === 'area' ? (
          <LineAreaView
            items={items}
            maxValue={maxValue}
            isArea={visual === 'area'}
            hoveredIndex={hoveredIndex}
            onHover={setHoveredIndex}
            formatter={displayFormatter}
            chartId={chartId}
          />
        ) : (
          <BarView
            items={items}
            maxValue={maxValue}
            hoveredIndex={hoveredIndex}
            onHover={setHoveredIndex}
            formatter={displayFormatter}
          />
        )}
      </div>

      {/* Interactive Footer / Legend */}
      <div className="mt-4 border-t border-clox-border-soft pt-3">
        {activeItem ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 font-medium text-clox-ink">
              <span
                className="h-2.5 w-2.5 rounded-full transition-transform duration-200 scale-125"
                style={{
                  backgroundColor:
                    activeItem.color ||
                    CHART_PALETTE[
                      items.findIndex((i) => i.id === activeItem.id) % CHART_PALETTE.length
                    ],
                }}
              />
              <span>{activeItem.label}:</span>
              <span className="font-bold text-clox-orange">
                {displayFormatter(activeItem.value)}
              </span>
            </div>
            {totalValue > 0 ? (
              <span className="text-clox-mute">
                {((activeItem.value / totalValue) * 100).toFixed(1)}% of total
              </span>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-clox-mute">
            <span>Total Volume:</span>
            <span className="font-bold text-clox-ink">{displayFormatter(totalValue)}</span>
          </div>
        )}

        {/* Color Legend chips */}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-clox-mute">
          {items.slice(0, 6).map((item, index) => {
            const color = item.color || CHART_PALETTE[index % CHART_PALETTE.length];
            const isHovered = hoveredIndex === index;
            return (
              <button
                type="button"
                key={item.id}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded transition hover:text-clox-ink focus:outline-none',
                  isHovered && 'font-semibold text-clox-ink',
                )}
              >
                <span
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full transition-transform duration-200',
                    isHovered && 'scale-125',
                  )}
                  style={{ backgroundColor: color }}
                />
                <span className="truncate max-w-[120px]">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-views with Motion Animations ──────────────────────────────────────

function BarView({
  items,
  maxValue,
  hoveredIndex,
  onHover,
  formatter,
}: {
  items: ChartDataItem[];
  maxValue: number;
  hoveredIndex: number | null;
  onHover: (idx: number | null) => void;
  formatter: (n: number) => string;
}) {
  return (
    <div className="flex h-48 w-full items-end gap-2 pt-6">
      {items.map((item, idx) => {
        const heightPct = Math.max(6, Math.round((item.value / maxValue) * 100));
        const color = item.color || CHART_PALETTE[idx % CHART_PALETTE.length];
        const isHovered = hoveredIndex === idx;

        return (
          <div
            key={item.id}
            onMouseEnter={() => onHover(idx)}
            onMouseLeave={() => onHover(null)}
            className="group relative flex flex-1 flex-col items-center justify-end h-full cursor-pointer transition-transform duration-200 hover:-translate-y-1"
          >
            {/* Tooltip on hover */}
            <div
              className={cn(
                'pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-clox-navy-ink px-2 py-0.5 text-[11px] font-semibold text-white shadow-lg transition-all duration-200 z-10',
                isHovered ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
              )}
            >
              {formatter(item.value)}
            </div>

            {/* Bar pillar with staggered growth animation */}
            <div className="relative w-full max-w-[48px] rounded-t-md bg-clox-surface-alt/70 overflow-hidden flex items-end h-full">
              <div
                className="w-full rounded-t-md transition-all duration-300"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: color,
                  transformOrigin: 'bottom',
                  animation: 'cloxBarGrow 0.75s cubic-bezier(0.16, 1, 0.3, 1) both',
                  animationDelay: `${idx * 0.06}s`,
                  opacity: isHovered ? 1 : hoveredIndex !== null ? 0.45 : 0.92,
                  boxShadow: isHovered ? `0 -4px 14px ${color}55` : 'none',
                }}
              />
            </div>

            {/* Label below bar */}
            <span
              className={cn(
                'mt-2 block w-full truncate text-center text-[11px] transition-colors duration-200',
                isHovered ? 'font-bold text-clox-ink scale-105' : 'text-clox-mute',
              )}
            >
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function LineAreaView({
  items,
  maxValue,
  isArea,
  hoveredIndex,
  onHover,
  formatter,
  chartId,
}: {
  items: ChartDataItem[];
  maxValue: number;
  isArea: boolean;
  hoveredIndex: number | null;
  onHover: (idx: number | null) => void;
  formatter: (n: number) => string;
  chartId: string;
}) {
  const width = 500;
  const height = 210;
  const padX = 42;
  const padYTop = 25;
  const padYBottom = 38; // Dedicated vertical space for perfectly centered date labels

  const points = useMemo(() => {
    if (items.length === 0) return [];
    const usableH = height - padYTop - padYBottom;

    if (items.length === 1) {
      return [
        {
          x: width / 2,
          y: height - padYBottom - ((items[0].value || 0) / maxValue) * usableH,
          item: items[0],
          idx: 0,
        },
      ];
    }

    const stepX = (width - padX * 2) / (items.length - 1);

    return items.map((item, idx) => {
      const x = padX + idx * stepX;
      const y = height - padYBottom - ((item.value || 0) / maxValue) * usableH;
      return { x, y, item, idx };
    });
  }, [items, maxValue, width, height, padX, padYTop, padYBottom]);

  const pathD = useMemo(() => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    return points.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      // Smooth cubic bezier curve
      const prev = points[i - 1];
      const cx1 = prev.x + (pt.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (pt.x - prev.x) / 2;
      const cy2 = pt.y;
      return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pt.x} ${pt.y}`;
    }, '');
  }, [points]);

  const areaD = useMemo(() => {
    if (points.length === 0) return '';
    const first = points[0];
    const last = points[points.length - 1];
    return `${pathD} L ${last.x} ${height - padYBottom} L ${first.x} ${height - padYBottom} Z`;
  }, [pathD, points, height, padYBottom]);

  const gradientId = `chart-grad-${chartId}`;
  const endPoint = points.length > 0 ? points[points.length - 1] : null;
  const startPoint = points.length > 0 ? points[0] : null;

  return (
    <div className="relative h-56 w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.45" />
            <stop offset="65%" stopColor="#0284c7" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Soft horizontal grid lines */}
        {[0.25, 0.5, 0.75, 1].map((pct) => {
          const usableH = height - padYTop - padYBottom;
          const y = height - padYBottom - pct * usableH;
          return (
            <line
              key={pct}
              x1={padX - 8}
              y1={y}
              x2={width - padX + 8}
              y2={y}
              stroke="var(--clox-border-soft)"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
          );
        })}

        {/* Crisp baseline */}
        <line
          x1={padX - 8}
          y1={height - padYBottom}
          x2={width - padX + 8}
          y2={height - padYBottom}
          stroke="var(--clox-border)"
          strokeWidth="1.25"
        />

        {/* Area fill with Orange-to-Blue tone and smooth rising animation */}
        {isArea ? (
          <path
            d={areaD}
            fill={`url(#${gradientId})`}
            style={{
              transformOrigin: 'bottom',
              animation: 'cloxAreaRise 1.2s cubic-bezier(0.16, 1, 0.3, 1) both',
            }}
          />
        ) : null}

        {/* Dynamic Generating Stroke Line with drawing motion */}
        <path
          d={pathD}
          fill="none"
          stroke="#f97316"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: 1400,
            strokeDashoffset: 1400,
            animation: 'cloxDrawLine 1.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        />

        {/* Start Point Ripple Wave */}
        {startPoint ? (
          <circle
            cx={startPoint.x}
            cy={startPoint.y}
            r="7"
            fill="#f97316"
            opacity="0.3"
            style={{
              animation: 'cloxRadarPulse 2s ease-out infinite',
            }}
          />
        ) : null}

        {/* Ending Point Live Pulse Radar Wave */}
        {endPoint ? (
          <circle
            cx={endPoint.x}
            cy={endPoint.y}
            r="8"
            fill="#0284c7"
            opacity="0.4"
            style={{
              animation: 'cloxRadarPulse 1.8s ease-out infinite',
              animationDelay: '1.2s',
            }}
          />
        ) : null}

        {/* Data points popping in sequentially */}
        {points.map((pt) => {
          const isHovered = hoveredIndex === pt.idx;
          const popDelay = 0.2 + (pt.idx / points.length) * 1.0;

          return (
            <g
              key={pt.item.id}
              className="cursor-pointer"
              onMouseEnter={() => onHover(pt.idx)}
              onMouseLeave={() => onHover(null)}
            >
              {isHovered ? (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="9"
                  fill="#0284c7"
                  opacity="0.3"
                  className="animate-ping"
                />
              ) : null}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isHovered ? 6 : 4}
                fill={isHovered ? '#0284c7' : '#fff'}
                stroke={isHovered ? '#0284c7' : '#f97316'}
                strokeWidth="2.5"
                style={{
                  transformOrigin: `${pt.x}px ${pt.y}px`,
                  animation: 'cloxPopIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both',
                  animationDelay: `${popDelay}s`,
                  transition: 'all 0.2s ease',
                }}
              />
            </g>
          );
        })}

        {/* Perfectly centered SVG X-axis date labels and ticks */}
        {points.map((pt) => {
          const isHovered = hoveredIndex === pt.idx;
          return (
            <g
              key={`axis-tick-${pt.item.id}`}
              className="cursor-pointer"
              onMouseEnter={() => onHover(pt.idx)}
              onMouseLeave={() => onHover(null)}
            >
              {/* Tick Mark */}
              <line
                x1={pt.x}
                y1={height - padYBottom}
                x2={pt.x}
                y2={height - padYBottom + 4}
                stroke={isHovered ? '#f97316' : 'var(--clox-border)'}
                strokeWidth={isHovered ? '2' : '1.25'}
              />
              {/* Crisp Date Text precisely centered on this coordinate */}
              <text
                x={pt.x}
                y={height - padYBottom + 19}
                textAnchor="middle"
                style={{
                  fill: isHovered ? '#f97316' : 'var(--clox-mute)',
                  fontSize: '11px',
                  fontWeight: isHovered ? 700 : 500,
                  transition: 'fill 0.2s ease, font-weight 0.2s ease',
                  userSelect: 'none',
                }}
              >
                {pt.item.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Floating tooltip for hovered point */}
      {hoveredIndex !== null && points[hoveredIndex] ? (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-md bg-clox-navy-ink px-2.5 py-1 text-xs font-semibold text-white shadow-xl transition-all animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: `${(points[hoveredIndex].x / width) * 100}%`,
            top: `${(points[hoveredIndex].y / height) * 100 - 10}%`,
          }}
        >
          <div className="text-[10px] opacity-80">{points[hoveredIndex].item.label}</div>
          <div>{formatter(points[hoveredIndex].item.value)}</div>
        </div>
      ) : null}
    </div>
  );
}

function PieDonutView({
  items,
  totalValue,
  hoveredIndex,
  onHover,
  formatter,
}: {
  items: ChartDataItem[];
  totalValue: number;
  hoveredIndex: number | null;
  onHover: (idx: number | null) => void;
  formatter: (n: number) => string;
}) {
  const size = 200;
  const center = size / 2;
  const outerR = 80;
  const innerR = 52;

  let cumulativeAngle = -90; // Start at 12 o'clock

  const slices = items.map((item, idx) => {
    const fraction = totalValue > 0 ? item.value / totalValue : 0;
    const sweepAngle = fraction * 360;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + sweepAngle;
    cumulativeAngle += sweepAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = center + outerR * Math.cos(startRad);
    const y1 = center + outerR * Math.sin(startRad);
    const x2 = center + outerR * Math.cos(endRad);
    const y2 = center + outerR * Math.sin(endRad);

    const x3 = center + innerR * Math.cos(endRad);
    const y3 = center + innerR * Math.sin(endRad);
    const x4 = center + innerR * Math.cos(startRad);
    const y4 = center + innerR * Math.sin(startRad);

    const largeArc = sweepAngle > 180 ? 1 : 0;

    const pathD =
      sweepAngle >= 359.9
        ? `M ${center} ${center - outerR} A ${outerR} ${outerR} 0 1 1 ${center} ${center + outerR} A ${outerR} ${outerR} 0 1 1 ${center} ${center - outerR} M ${center} ${center - innerR} A ${innerR} ${innerR} 0 1 0 ${center} ${center + innerR} A ${innerR} ${innerR} 0 1 0 ${center} ${center - innerR} Z`
        : `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`;

    const color = item.color || CHART_PALETTE[idx % CHART_PALETTE.length];

    return {
      id: item.id,
      item,
      idx,
      pathD,
      color,
      fraction,
    };
  });

  const activeSlice = hoveredIndex !== null ? slices[hoveredIndex] : null;

  return (
    <div className="flex h-52 items-center justify-center">
      <div className="relative">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {slices.map((slice) => {
            const isHovered = hoveredIndex === slice.idx;
            return (
              <path
                key={slice.id}
                d={slice.pathD}
                fill={slice.color}
                onMouseEnter={() => onHover(slice.idx)}
                onMouseLeave={() => onHover(null)}
                className="cursor-pointer transition-all duration-300 ease-out"
                style={{
                  transformOrigin: `${center}px ${center}px`,
                  animation: 'cloxSlicePop 0.75s cubic-bezier(0.16, 1, 0.3, 1) both',
                  animationDelay: `${slice.idx * 0.07}s`,
                  transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                  opacity: isHovered ? 1 : hoveredIndex !== null ? 0.4 : 0.92,
                  filter: isHovered
                    ? 'drop-shadow(0 6px 14px rgba(249,115,22,0.4))'
                    : 'none',
                }}
              />
            );
          })}
        </svg>

        {/* Center label with smooth counter */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-medium uppercase tracking-wider text-clox-mute">
            {activeSlice ? activeSlice.item.label : 'Total'}
          </span>
          <span className="font-display text-base font-bold text-clox-ink transition-transform duration-200">
            {activeSlice ? (
              formatter(activeSlice.item.value)
            ) : (
              <AnimatedNumber value={totalValue} formatter={formatter} />
            )}
          </span>
          {activeSlice ? (
            <span className="text-[10px] font-semibold text-clox-orange animate-in fade-in duration-150">
              {(activeSlice.fraction * 100).toFixed(1)}%
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
