import { useEffect, useRef } from "react";
import Phaser from "phaser";
import type { Player } from "./types";
import { DEFAULT_GAME_HEIGHT, DEFAULT_GAME_WIDTH } from "./gameConfig";

interface PhaserGameProps {
    players: Player[];
    width?: number;
    height?: number;
    className?: string;
}

const PLAYER_COLORS = [
    "#e6194b",
    "#3cb44b",
    "#ffe119",
    "#4363d8",
    "#f58231",
    "#911eb4",
    "#46f0f0",
    "#f032e6",
    "#bcf60c",
    "#fabebe",
    "#008080",
    "#e6beff",
    "#9a6324",
    "#fffac8",
    "#800000",
    "#aaffc3",
    "#808000",
    "#ffd8b1",
    "#000075",
    "#808080",
    "#ffffff",
    "#000000",
];

class CurvefeverScene extends Phaser.Scene {
    players: Player[] = [];
    playerSprites: Map<string, Phaser.GameObjects.Graphics> = new Map();
    // Track how much trail we've already drawn so we only draw new points
    drawnTrailCounts: Map<string, { segments: number; points: number }> =
        new Map();

    constructor() {
        super("CurvefeverScene");
    }

    create() {
        this.playerSprites.clear();
        this.drawnTrailCounts.clear();
        this.cameras.main.setBackgroundColor("#222");
        const players = Array.isArray(this.players) ? this.players : [];
        players.forEach((p, i) => {
            const g = this.add.graphics();
            const colorHex = p.color || PLAYER_COLORS[i % PLAYER_COLORS.length];
            g.fillStyle(parseInt(colorHex.replace("#", ""), 16), 1);
            g.fillCircle(0, 0, 8);
            g.x = p.x;
            g.y = p.y;
            this.playerSprites.set(p.id, g);
        });
    }

    setPlayers(players: Player[] = []) {
        this.players = Array.isArray(players) ? players : [];
    }

    resetTrails() {
        // Clear all trail graphics and drawn counts (used on round restart / full sync)
        for (const [key, g] of this.playerSprites.entries()) {
            if (key.endsWith("_trail")) {
                g.clear();
            }
        }
        this.drawnTrailCounts.clear();
    }

    updatePlayers(players: Player[] = [], fullSync: boolean = false) {
        if (!this.add) return;
        this.players = Array.isArray(players) ? players : [];
        const width = this.sys.game.config.width as number;
        const height = this.sys.game.config.height as number;

        if (fullSync) {
            this.resetTrails();
        }

        this.players.forEach((p, i) => {
            const x = ((p.x % width) + width) % width;
            const y = ((p.y % height) + height) % height;

            const color =
                p.color && /^#/.test(p.color)
                    ? p.color
                    : PLAYER_COLORS[i % PLAYER_COLORS.length];
            const colorNum = Phaser.Display.Color.HexStringToColor(color).color;

            // --- Incremental trail drawing ---
            let trailG = this.playerSprites.get(p.id + "_trail");
            if (!trailG) {
                trailG = this.add.graphics();
                this.playerSprites.set(p.id + "_trail", trailG);
            }

            const segments = Array.isArray(p.trail) ? p.trail : [];
            const drawn = this.drawnTrailCounts.get(p.id) ?? {
                segments: 0,
                points: 0,
            };

            // Detect trail reset (round restart): trail is shorter than what we've drawn
            const trailShrunk =
                segments.length < drawn.segments ||
                (segments.length === 1 &&
                    drawn.segments >= 1 &&
                    segments[0].length < drawn.points);
            if (trailShrunk) {
                trailG.clear();
                this.drawnTrailCounts.set(p.id, { segments: 0, points: 0 });
            }

            const currentDrawn = trailShrunk
                ? { segments: 0, points: 0 }
                : drawn;

            trailG.lineStyle(3, colorNum, 1);

            for (
                let s = Math.max(0, currentDrawn.segments - 1);
                s < segments.length;
                s++
            ) {
                const seg = segments[s];
                if (!Array.isArray(seg) || seg.length < 2) continue;

                // Determine where to start drawing in this segment
                let startIdx: number;
                if (s === currentDrawn.segments - 1) {
                    // Continue from where we left off in this segment
                    startIdx = Math.max(0, currentDrawn.points - 1);
                } else if (s >= currentDrawn.segments) {
                    // New segment, draw from beginning
                    startIdx = 0;
                } else {
                    continue; // Already fully drawn
                }

                if (startIdx >= seg.length - 1) continue;

                trailG.beginPath();
                trailG.moveTo(seg[startIdx].x, seg[startIdx].y);
                for (let j = startIdx + 1; j < seg.length; j++) {
                    trailG.lineTo(seg[j].x, seg[j].y);
                }
                trailG.strokePath();
            }

            // Update drawn counts
            this.drawnTrailCounts.set(p.id, {
                segments: segments.length,
                points:
                    segments.length > 0
                        ? segments[segments.length - 1].length
                        : 0,
            });

            // --- Player head ---
            let g = this.playerSprites.get(p.id);
            if (!g) {
                g = this.add.graphics();
                this.playerSprites.set(p.id, g);
            }
            g.clear();
            g.fillStyle(colorNum, 1);
            g.fillCircle(0, 0, 8);
            g.x = x;
            g.y = y;
        });
    }

    update() {
        // No-op: all updates are handled via updatePlayers
    }
}

export default function PhaserGame({
    players,
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

    return (
        <div className={`phaser-shell ${className ?? ""}`.trim()}>
            <div ref={gameRef} className="phaser-host" />
        </div>
    );
}
