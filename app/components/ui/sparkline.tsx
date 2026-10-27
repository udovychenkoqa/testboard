import { STATUS_COLORS } from '@/app/lib/tailwind';

interface SparklineProps {
  values: number[]; // e.g. pass rates 0..100
  width?: number;
  height?: number;
  color?: string;
  lastColor?: string; // endpoint dot colour
}

// Polyline sparkline with a soft fill and an emphasized last point.
export const Sparkline: React.FC<SparklineProps> = ({
  values,
  width = 120,
  height = 44,
  color = STATUS_COLORS.passed,
  lastColor,
}) => {
  if (values.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const x = (i: number) => (i / (values.length - 1)) * (width - pad * 2) + pad;
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const lastX = x(values.length - 1);
  const lastY = y(values[values.length - 1]);

  return (
    <svg height={height} width={width}>
      {/* Colours go through `style`: theme var() values don't resolve in SVG presentation attributes. */}
      <polygon fillOpacity={0.1} points={`${pts} ${lastX},${height} ${pad},${height}`} style={{ fill: color }} />
      <polyline fill="none" points={pts} strokeLinejoin="round" strokeWidth={2} style={{ stroke: color }} />
      <circle cx={lastX} cy={lastY} r={3.5} style={{ fill: lastColor ?? color }} />
    </svg>
  );
};

// "10 squares" history strip — one square per run, last one outlined.
export const SparkSquares: React.FC<{ colors: string[]; className?: string }> = ({ colors, className }) => (
  <div className={`flex items-center gap-0.5 ${className ?? ''}`}>
    {colors.map((c, i) => (
      <span
        key={i}
        className="rounded-[3px]"
        style={{
          width: 9,
          height: 14,
          backgroundColor: c,
          outline: i === colors.length - 1 ? '2px solid hsl(var(--heroui-primary))' : undefined, // i18n-ignore — CSS value
          outlineOffset: i === colors.length - 1 ? 1 : undefined,
        }}
      />
    ))}
  </div>
);
