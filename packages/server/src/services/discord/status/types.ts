/**
 * Status category types for organizing different kinds of statuses
 */
export enum StatusCategory {
  /** General information about the service */
  INFO = "info",
  /** System health and monitoring statuses */
  MONITORING = "monitoring",
  /** Database and data-related statuses */
  DATA = "data",
  /** Network and connectivity statuses */
  NETWORK = "network",
  /** Performance metrics */
  PERFORMANCE = "performance",
}

/**
 * Status configuration with optional dynamic data
 */
export interface StatusConfig {
  /** Status text to display */
  text: string;
  /** Category organization */
  category: StatusCategory;
  /** Optional function to generate dynamic status */
  dynamic?: () => Promise<string> | string;
}

/**
 * Rotating statuses for the web bot
 * Organized by category for better maintenance
 */
export const statusConfigs: StatusConfig[] = [
  // Info statuses
  {
    text: "🌐 createrington.com",
    category: StatusCategory.INFO,
  },
  {
    text: "⚙️ Web Services v6.0",
    category: StatusCategory.INFO,
  },
  {
    text: "📦 Modpack v0.1.9",
    category: StatusCategory.INFO,
  },

  // Monitoring statuses
  {
    text: "📊 Dashboard: Online",
    category: StatusCategory.MONITORING,
  },
  {
    text: "📡 WebSocket: Active",
    category: StatusCategory.MONITORING,
  },
  {
    text: "🔍 System Monitor: OK",
    category: StatusCategory.MONITORING,
  },
  {
    text: "⚠️ Status: Operational",
    category: StatusCategory.MONITORING,
  },
  {
    text: "🛰️ Uptime Monitor: Active",
    category: StatusCategory.MONITORING,
  },

  // Data statuses
  {
    text: "🔗 Database: Synced",
    category: StatusCategory.DATA,
  },
  {
    text: "📂 Logs: Indexed",
    category: StatusCategory.DATA,
  },
  {
    text: "🧬 Cache: Updated",
    category: StatusCategory.DATA,
  },
  {
    text: "🗂️ Query Pool: Ready",
    category: StatusCategory.DATA,
  },

  // Network statuses
  {
    text: "🌐 API Gateway: Online",
    category: StatusCategory.NETWORK,
  },
  {
    text: "🔒 TLS: Secured",
    category: StatusCategory.NETWORK,
  },
  {
    text: "📡 SocketIO: Connected",
    category: StatusCategory.NETWORK,
  },
  {
    text: "🔌 Endpoints: Available",
    category: StatusCategory.NETWORK,
  },

  // Performance statuses
  {
    text: "⏱️ Response: <50ms",
    category: StatusCategory.PERFORMANCE,
  },
  {
    text: "📈 Performance: Optimal",
    category: StatusCategory.PERFORMANCE,
  },
  {
    text: "📉 Zero Downtime",
    category: StatusCategory.PERFORMANCE,
  },
  {
    text: "🚀 Load: Balanced",
    category: StatusCategory.PERFORMANCE,
  },
];
