import React from "react";

interface VitalsDisplayProps {
  heartRate: number;
  hrv: number;
  spo2: number;
  temperature: number;
  stepsToday?: number;
  caloriesBurned?: number;
  stressLevel?: string;
  compact?: boolean;
}

const Stat: React.FC<{ label: string; value: string | number; unit: string; color: string }> = ({
  label, value, unit, color,
}) => (
  <div className="bp-stat">
    <span className="bp-stat-label">{label}</span>
    <span className="bp-stat-value" style={{ color }}>
      {value} <small>{unit}</small>
    </span>
  </div>
);

export const VitalsDisplay: React.FC<VitalsDisplayProps> = ({
  heartRate,
  hrv,
  spo2,
  temperature,
  stepsToday,
  caloriesBurned,
  stressLevel,
  compact = false,
}) => {
  if (compact) {
    return (
      <div className="bp-stats-row">
        <Stat label="HR" value={heartRate} unit="bpm" color="#00ff88" />
        <Stat label="HRV" value={hrv} unit="ms" color="#00ccff" />
        <Stat label="SpO2" value={spo2} unit="%" color="#a78bfa" />
      </div>
    );
  }

  return (
    <div>
      <div className="bp-stats-row" style={{ marginBottom: 12 }}>
        <Stat label="HEART RATE" value={heartRate} unit="bpm" color="#00ff88" />
        <Stat label="HRV" value={hrv} unit="ms" color="#00ccff" />
        <Stat label="SpO2" value={spo2} unit="%" color="#a78bfa" />
        <Stat label="TEMP" value={temperature.toFixed(1)} unit="°F" color="#f59e0b" />
      </div>
      {(stepsToday !== undefined || caloriesBurned !== undefined || stressLevel) && (
        <div className="bp-stats-row">
          {stepsToday !== undefined && <Stat label="STEPS" value={stepsToday} unit="" color="#00ff88" />}
          {caloriesBurned !== undefined && <Stat label="CALORIES" value={caloriesBurned} unit="kcal" color="#ff6b6b" />}
          {stressLevel && (
            <Stat
              label="STRESS"
              value={stressLevel.toUpperCase()}
              unit=""
              color={stressLevel === "low" ? "#00ff88" : stressLevel === "moderate" ? "#ffaa00" : "#ff4466"}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default VitalsDisplay;
