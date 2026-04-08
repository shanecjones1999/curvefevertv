import { useEffect, useRef } from "react";
import Phaser from "phaser";
import type { Player, PowerUp } from "./types";
import {
    DEFAULT_GAME_HEIGHT,
    DEFAULT_GAME_WIDTH,
    PLAYER_TRAIL_WIDTH,
} from "./gameConfig";
import { PLAYER_COLORS } from "./constants/gameUi";

interface PhaserGameProps {
    players: Player[];
    powerUps?: PowerUp[];
    width?: number;
    height?: number;
    className?: string;
}

class CurvefeverScene extends Phaser.Scene {
    players: Player[] = [];
    powerUps: PowerUp[] = [];
    playerSprites: Map<string, Phaser.GameObjects.Graphics> = new Map();
    powerUpSprites: Map<string, Phaser.GameObjects.Graphics> = new Map();

    constructor() {
        super("CurvefeverScene");
    }

    create() {
        this.playerSprites.clear();
        this.powerUpSprites.clear();
        this.cameras.main.setBackgroundColor("#222");
        // Defensive: always use array
        const players = Array.isArray(this.players) ? this.players : [];
        players.forEach((p, i) => {
            const g = this.add.graphics();
            // Convert color string to number for Phaser
            const colorHex = p.color || PLAYER_COLORS[i % PLAYER_COLORS.length];
            g.fillStyle(parseInt(colorHex.replace("#", ""), 16), 1);
            g.fillCircle(0, 0, 8);
            g.x = p.x;
            g.y = p.y;
            this.playerSprites.set(p.id, g);
        });
    }

    setPowerUps(powerUps: PowerUp[] = []) {
        this.powerUps = Array.isArray(powerUps) ? powerUps : [];
    }

    setPlayers(players: Player[] = []) {
        this.players = Array.isArray(players) ? players : [];
        // Do not call updatePlayers here; let React effect call it after scene is ready
    }

    updatePlayers(players: Player[] = []) {
        if (!this.add) return;
        this.players = Array.isArray(players) ? players : [];

        const incomingPlayerIds = new Set(
            this.players.map((player) => player.id),
        );

        for (const [key, graphic] of this.playerSprites.entries()) {
            const playerId = key.endsWith("_trail")
                ? key.slice(0, -"_trail".length)
                : key;
            if (!incomingPlayerIds.has(playerId)) {
                graphic.destroy();
                this.playerSprites.delete(key);
            }
        }

        this.players.forEach((p, i) => {
            // Draw trail
            let trailG = this.playerSprites.get(p.id + "_trail");
            if (!trailG) {
                trailG = this.add.graphics();
                this.playerSprites.set(p.id + "_trail", trailG);
            }
            trailG.clear();
            trailG.setVisible(true);
            const color =
                p.color && /^#/.test(p.color)
                    ? p.color
                    : PLAYER_COLORS[i % PLAYER_COLORS.length];
            trailG.lineStyle(
                PLAYER_TRAIL_WIDTH,
                Phaser.Display.Color.HexStringToColor(color).color,
                1,
            );
            const segments = Array.isArray(p.trail) ? p.trail : [];
            for (const segment of segments) {
                if (!Array.isArray(segment) || segment.length < 2) continue;
                trailG.beginPath();
                trailG.moveTo(segment[0].x, segment[0].y);
                for (let j = 1; j < segment.length; j++) {
                    trailG.lineTo(segment[j].x, segment[j].y);
                }
                trailG.strokePath();
            }

            // Draw player
            let g = this.playerSprites.get(p.id);
            if (!g) {
                g = this.add.graphics();
                this.playerSprites.set(p.id, g);
            }
            g.setVisible(true);
            g.clear();
            g.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 1);
            g.fillCircle(0, 0, 8);
            g.x = p.x;
            g.y = p.y;
        });
    }

    updatePowerUps(powerUps: PowerUp[] = []) {
        if (!this.add) return;
        this.powerUps = Array.isArray(powerUps) ? powerUps : [];

        const incomingPowerUpIds = new Set(
            this.powerUps.map((powerUp) => powerUp.id),
        );
        for (const [powerUpId, graphic] of this.powerUpSprites.entries()) {
            if (!incomingPowerUpIds.has(powerUpId)) {
                graphic.destroy();
                this.powerUpSprites.delete(powerUpId);
            }
        }

        this.powerUps.forEach((powerUp) => {
            let graphic = this.powerUpSprites.get(powerUp.id);
            if (!graphic) {
                graphic = this.add.graphics();
                this.powerUpSprites.set(powerUp.id, graphic);
            }

            const fillColor =
                powerUp.type === "speed-up"
                    ? Phaser.Display.Color.HexStringToColor("#44d37f").color
                    : Phaser.Display.Color.HexStringToColor("#ff8a4c").color;

            graphic.clear();
            graphic.fillStyle(fillColor, 1);
            graphic.fillCircle(0, 0, 10);
            graphic.lineStyle(2, 0xffffff, 0.8);
            graphic.strokeCircle(0, 0, 10);
            graphic.x = powerUp.x;
            graphic.y = powerUp.y;
        });
    }

    update() {
        // No-op: all updates are handled via updatePlayers
    }
}

export default function PhaserGame({
    players,
    powerUps = [],
    width = DEFAULT_GAME_WIDTH,
    height = DEFAULT_GAME_HEIGHT,
    className,
}: PhaserGameProps) {
    const gameRef = useRef<HTMLDivElement>(null);
    const phaserRef = useRef<Phaser.Game | null>(null);
    const sceneRef = useRef<CurvefeverScene | null>(null);

    useEffect(() => {
        if (!gameRef.current) return;
        if (phaserRef.current) return;

        const scene = new CurvefeverScene();
        sceneRef.current = scene;
        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,
            width,
            height,
            parent: gameRef.current,
            scene,
            physics: { default: "arcade" },
            backgroundColor: "#222",
            scale: {
                mode: Phaser.Scale.FIT,
                autoCenter: Phaser.Scale.CENTER_BOTH,
                width,
                height,
            },
        };
        phaserRef.current = new Phaser.Game(config);
        return () => {
            phaserRef.current?.destroy(true);
            phaserRef.current = null;
        };
    }, [width, height]);

    useEffect(() => {
        // Only update players if scene and playerSprites are ready
        if (sceneRef.current && sceneRef.current.playerSprites) {
            sceneRef.current.updatePlayers(players);
        }
    }, [players]);

    useEffect(() => {
        if (sceneRef.current && sceneRef.current.powerUpSprites) {
            sceneRef.current.updatePowerUps(powerUps);
        }
    }, [powerUps]);

    return (
        <div className={`phaser-shell ${className ?? ""}`.trim()}>
            <div ref={gameRef} className="phaser-host" />
        </div>
    );
}
