module.exports = {
  apps: [
    {
      name: "fast-food-pos-api",
      cwd: "/var/www/pos/server",
      script: "src/server.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 5000
      }
    }
  ]
};
