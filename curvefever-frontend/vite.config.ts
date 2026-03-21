import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendProxyTarget =
    process.env.VITE_BACKEND_PROXY_TARGET ?? "http://127.0.0.1:3001";
const defaultKeyPath = path.resolve(__dirname, "../certs/dev-key.pem");
const defaultCertPath = path.resolve(__dirname, "../certs/dev-cert.pem");
const httpsKeyPath = process.env.VITE_SSL_KEY ?? defaultKeyPath;
const httpsCertPath = process.env.VITE_SSL_CERT ?? defaultCertPath;
const hasHttpsCerts =
    fs.existsSync(httpsKeyPath) && fs.existsSync(httpsCertPath);

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        host: "0.0.0.0",
        port: 5173,
        https: hasHttpsCerts
            ? {
                  key: fs.readFileSync(httpsKeyPath),
                  cert: fs.readFileSync(httpsCertPath),
              }
            : undefined,
        proxy: {
            "/socket.io": {
                target: backendProxyTarget,
                ws: true,
                changeOrigin: true,
                secure: false,
            },
        },
    },
});
