import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { X509Certificate } from "node:crypto";
import { execFileSync } from "node:child_process";
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

function getLanIpAddresses() {
    const interfaces = os.networkInterfaces();
    const lanIps = new Set<string>();

    for (const addresses of Object.values(interfaces)) {
        if (!addresses) continue;

        for (const address of addresses) {
            if (address.internal || address.family !== "IPv4") continue;

            lanIps.add(address.address);
        }
    }

    return Array.from(lanIps).sort();
}

function getRequiredHttpsHosts() {
    return ["localhost", "127.0.0.1", "::1", ...getLanIpAddresses()];
}

function getCertificateSubjectAltNames(certPath: string) {
    const certificate = new X509Certificate(fs.readFileSync(certPath));
    const subjectAltName = certificate.subjectAltName;

    if (!subjectAltName) {
        return new Set<string>();
    }

    return new Set(
        subjectAltName
            .split(", ")
            .map((entry) => entry.replace(/^DNS:/, "").replace(/^IP Address:/, "")),
    );
}

function ensureDefaultHttpsCerts() {
    const requiredHosts = getRequiredHttpsHosts();
    const certExists =
        fs.existsSync(defaultKeyPath) && fs.existsSync(defaultCertPath);

    if (certExists) {
        const subjectAltNames = getCertificateSubjectAltNames(defaultCertPath);
        const missingHosts = requiredHosts.filter((host) => !subjectAltNames.has(host));

        if (!missingHosts.length) {
            return true;
        }
    }

    try {
        fs.mkdirSync(path.dirname(defaultKeyPath), { recursive: true });
        execFileSync(
            "mkcert",
            [
                "-key-file",
                defaultKeyPath,
                "-cert-file",
                defaultCertPath,
                ...requiredHosts,
            ],
            { stdio: "pipe" },
        );
        return true;
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "unknown mkcert error";
        console.warn(
            `Unable to generate local HTTPS cert for LAN IPs: ${message}`,
        );
        return certExists;
    }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => {
    const hasCustomHttpsCerts =
        process.env.VITE_SSL_KEY || process.env.VITE_SSL_CERT;
    const hasHttpsCerts =
        command === "serve"
            ? hasCustomHttpsCerts
                ? fs.existsSync(httpsKeyPath) && fs.existsSync(httpsCertPath)
                : ensureDefaultHttpsCerts()
            : false;

    return {
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
    };
});
