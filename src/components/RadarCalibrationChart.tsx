import React from 'react';
import type { ForensicSubScores } from '../types/forensics';

interface RadarCalibrationChartProps {
  subScores: ForensicSubScores;
}

const AXES: Array<{ key: keyof ForensicSubScores; label: string }> = [
  { key: 'ganCheckerboard', label: 'GAN GRID' },
  { key: 'diffusionTexture', label: 'DIFFUSION' },
  { key: 'lightingGeometry', label: 'LIGHTING' },
  { key: 'typographyStructure', label: 'STRUCTURE' },
  { key: 'compressionIntegrity', label: 'COMPRESSION' },
];

export const RadarCalibrationChart: React.FC<RadarCalibrationChartProps> = ({
  subScores,
}) => {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 78;
  const levels = [25, 50, 75, 100];

  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / AXES.length - Math.PI / 2;
    const r = (Math.max(0, Math.min(100, value)) / 100) * maxR;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  const dataPolygon = AXES.map((axis, idx) => {
    const pt = getPoint(idx, subScores[axis.key]);
    return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
  }).join(' ');

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full max-w-[260px] overflow-visible"
        role="img"
        aria-label="5-axis forensic anomaly calibration radar"
      >
        {levels.map((lvl) => {
          const ringPoints = AXES.map((_, idx) => {
            const pt = getPoint(idx, lvl);
            return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
          }).join(' ');
          return (
            <polygon
              key={lvl}
              points={ringPoints}
              fill="none"
              stroke="rgba(148, 163, 184, 0.16)"
              strokeWidth={1}
            />
          );
        })}

        {AXES.map((axis, idx) => {
          const outer = getPoint(idx, 100);
          const labelPt = getPoint(idx, 126);
          const val = Math.round(subScores[axis.key]);
          return (
            <g key={axis.key}>
              <line
                x1={cx}
                y1={cy}
                x2={outer.x}
                y2={outer.y}
                stroke="rgba(148, 163, 184, 0.2)"
                strokeWidth={1}
              />
              <text
                x={labelPt.x}
                y={labelPt.y - 5}
                textAnchor="middle"
                className="fill-slate-400 font-mono text-[9px] tracking-wider"
              >
                {axis.label}
              </text>
              <text
                x={labelPt.x}
                y={labelPt.y + 7}
                textAnchor="middle"
                className="fill-slate-200 font-mono text-[10px] font-semibold tabular-nums"
              >
                {val}%
              </text>
            </g>
          );
        })}

        <polygon
          points={dataPolygon}
          fill="rgba(6, 182, 212, 0.18)"
          stroke="#06B6D4"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {AXES.map((axis, idx) => {
          const pt = getPoint(idx, subScores[axis.key]);
          return (
            <circle
              key={axis.key}
              cx={pt.x}
              cy={pt.y}
              r={3.5}
              fill="#090C12"
              stroke="#22D3EE"
              strokeWidth={2}
            />
          );
        })}
      </svg>
    </div>
  );
};
