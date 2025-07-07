module.exports = {
  apps: [
    {
      name: "viettruyen",
      script: "dist/index.js", // Dùng file đã build trong production
      interpreter: "node",
      env: {
        NODE_ENV: "development",
        PORT: 5008,
        WATCH: true,
        TS_NODE: true,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 5008,
        WATCH: false,
        TS_NODE: false,
      },
      watch: process.env.NODE_ENV === "development",
      ignore_watch: ["node_modules", "uploads", ".git"],
      max_memory_restart: "1G",
      restart_delay: 3000,
      max_restarts: 10,
      autorestart: true,
      instances: 1,
      exec_mode: "fork",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
      error_file: "logs/error.log",
      out_file: "logs/output.log",
      time: true,
    },
  ],
};
