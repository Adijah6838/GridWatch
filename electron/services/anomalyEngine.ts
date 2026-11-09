import { getDB } from '../database/connection';

// Limits for our simulated stations
const MAX_VOLTAGE = 245;
const MIN_VOLTAGE = 215;
const MAX_TEMPERATURE = 55;

export function detectAnomalies(telemetryBatch: any[]) {
  const db = getDB();
  const insertAnomaly = db.prepare(`
    INSERT INTO anomalies (station_id, category, severity, detected_value, expected_range, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  telemetryBatch.forEach(reading => {
    // 1. Check High Voltage
    if (reading.voltage > MAX_VOLTAGE) {
      insertAnomaly.run(
        reading.station_id, 'Voltage', 'High', reading.voltage, 
        `<= ${MAX_VOLTAGE} V`, `Station ${reading.station_name} exceeded max voltage.`
      );
    }
    // 2. Check Low Voltage
    else if (reading.voltage < MIN_VOLTAGE) {
      insertAnomaly.run(
        reading.station_id, 'Voltage', 'Warning', reading.voltage, 
        `>= ${MIN_VOLTAGE} V`, `Station ${reading.station_name} voltage dropped too low.`
      );
    }

    // 3. Check High Temperature
    if (reading.temperature > MAX_TEMPERATURE) {
      const severity = reading.temperature > 60 ? 'Critical' : 'High';
      insertAnomaly.run(
        reading.station_id, 'Temperature', severity, reading.temperature, 
        `<= ${MAX_TEMPERATURE} °C`, `Station ${reading.station_name} is overheating.`
      );
    }
  });
}
