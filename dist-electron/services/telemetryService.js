"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTelemetry = generateTelemetry;
exports.saveTelemetryToDB = saveTelemetryToDB;
const connection_1 = require("../database/connection");
const STATIONS = [
    { id: 1, name: 'Alpha Station', region: 'North', baseVoltage: 230, baseTemp: 45 },
    { id: 2, name: 'Beta Station', region: 'North', baseVoltage: 235, baseTemp: 48 },
    { id: 3, name: 'Gamma Station', region: 'South', baseVoltage: 220, baseTemp: 42 },
    { id: 4, name: 'Delta Station', region: 'South', baseVoltage: 225, baseTemp: 44 },
    { id: 5, name: 'Epsilon Station', region: 'East', baseVoltage: 240, baseTemp: 50 },
    { id: 6, name: 'Zeta Station', region: 'East', baseVoltage: 238, baseTemp: 49 },
    { id: 7, name: 'Eta Station', region: 'West', baseVoltage: 228, baseTemp: 46 },
    { id: 8, name: 'Theta Station', region: 'West', baseVoltage: 232, baseTemp: 47 },
    { id: 9, name: 'Iota Station', region: 'Central', baseVoltage: 225, baseTemp: 43 },
    { id: 10, name: 'Kappa Station', region: 'Central', baseVoltage: 230, baseTemp: 45 },
];
function generateTelemetry() {
    return STATIONS.map(station => {
        // Generate slightly randomized data around the base values
        let voltage = station.baseVoltage + (Math.random() * 10 - 5);
        let current = 50 + (Math.random() * 20 - 10);
        let temperature = station.baseTemp + (Math.random() * 8 - 4);
        // 10% chance to inject a high voltage anomaly
        if (Math.random() > 0.9) {
            voltage = 246 + Math.random() * 10; // Spikes over 245
        }
        // 10% chance to inject a high temperature anomaly
        if (Math.random() > 0.9) {
            temperature = 56 + Math.random() * 8; // Spikes over 55
        }
        const powerConsumption = voltage * current; // P = V * I
        const energyGenerated = 5000 + (Math.random() * 1000 - 500); // Simulated kWh
        return {
            station_id: station.id,
            station_name: station.name,
            region: station.region,
            voltage: parseFloat(voltage.toFixed(2)),
            current: parseFloat(current.toFixed(2)),
            temperature: parseFloat(temperature.toFixed(2)),
            power_consumption: parseFloat(powerConsumption.toFixed(2)),
            energy_generated: parseFloat(energyGenerated.toFixed(2)),
            timestamp: new Date().toISOString()
        };
    });
}
function saveTelemetryToDB(readings) {
    const db = (0, connection_1.getDB)();
    const insert = db.prepare(`
    INSERT INTO telemetry (station_id, voltage, current, temperature, power_consumption, energy_generated, timestamp)
    VALUES (@station_id, @voltage, @current, @temperature, @power_consumption, @energy_generated, @timestamp)
  `);
    const insertMany = db.transaction((data) => {
        for (const item of data)
            insert.run(item);
    });
    insertMany(readings);
}
