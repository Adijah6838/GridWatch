# GridWatch - Real-Time Smart Energy Grid Monitoring Platform

GridWatch is an advanced, enterprise-grade desktop application designed for monitoring, analytics, and incident response for smart energy grids. Built completely offline, it simulates 10 electrical stations, tracks telemetry in real-time, detects anomalies, manages incidents, and provides a comprehensive operational dashboard.

## Core Features
- **Real-Time Monitoring:** Simulates 10 stations generating voltage, current, and temperature data every 3 seconds over WebSockets.
- **Intelligent Anomaly Detection:** Automatically detects thresholds and statistical deviations (high voltage, overheating) and creates alerts.
- **Incident Management:** Full lifecycle management (Open, Investigating, Resolved) for grid incidents with operator assignment.
- **Energy Analytics:** Interactive Chart.js visualizations for historical energy generation, consumption, and temperature trends.
- **Background Processing Engine:** Uses Node.js Worker Threads to calculate heavy analytics without freezing the main UI.
- **Role-Based Access Control (RBAC):** Secure login for Administrators, Monitoring Operators, Analysts, and Read-only Viewers.
- **Event-Driven Architecture:** Logs all system actions (logins, incidents, jobs) to an immutable SQLite event log.
- **CSV Export:** Export telemetry, incidents, and system logs to CSV using native OS dialogs.

## Technology Stack
- **Electron.js** (Desktop Runtime)
- **React + Vite** (Frontend UI)
- **TypeScript** (Strongly-typed logic)
- **Node.js** (Backend & Worker Threads)
- **SQLite (better-sqlite3)** (Relational Database)
- **Socket.io** (Real-Time WebSockets)
- **Chart.js** (Data Visualization)
- **Crypto** (Password Hashing)

## Getting Started

### Prerequisites
You need [Node.js](https://nodejs.org/) installed on your computer.

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/Adijah6838/GridWatch.git