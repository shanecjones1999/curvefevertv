import { Express } from "express";

export function registerHttpRoutes(app: Express) {
    app.get("/", (_req, res) => res.send("Curvefever backend running"));
}
