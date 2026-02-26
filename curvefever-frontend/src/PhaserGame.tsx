import React, { useEffect, useRef } from "react";
import Phaser from "phaser";
import type { Player } from "../../shared-types/types";

interface PhaserGameProps {
    players: Player[];
    width?: number;
    height?: number;
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

    constructor() {
        super("CurvefeverScene");
    }

    create() {
        this.playerSprites.clear();
        this.cameras.main.setBackgroundColor("#222");
        // Defensive: always use array
        const players = Array.isArray(this.players) ? this.players : [];
        players.forEach((p, i) => {
            const g = this.add.graphics();
            g.fillStyle(p.color || PLAYER_COLORS[i % PLAYER_COLORS.length], 1);
            g.fillCircle(0, 0, 8);
            g.x = p.x;
            g.y = p.y;
            this.playerSprites.set(p.id, g);
        });
    }

    setPlayers(players: Player[] = []) {
        this.players = Array.isArray(players) ? players : [];
        // Do not call updatePlayers here; let React effect call it after scene is ready
    }

    updatePlayers(players: Player[] = []) {
        if (!this.add) return;
        this.players = Array.isArray(players) ? players : [];
        const width = this.sys.game.config.width as number;
        const height = this.sys.game.config.height as number;

        this.players.forEach((p, i) => {
            // Calculate wrapped position
            let x = ((p.x % width) + width) % width;
            let y = ((p.y % height) + height) % height;

            // Draw trail
            let trailG = this.playerSprites.get(p.id + "_trail");
            if (!trailG) {
                trailG = this.add.graphics();
                this.playerSprites.set(p.id + "_trail", trailG);
            }
            trailG.clear();
            const color =
                p.color && /^#/.test(p.color)
                    ? p.color
                    : PLAYER_COLORS[i % PLAYER_COLORS.length];
            trailG.lineStyle(
                3,
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
            g.clear();
            g.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 1);
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
    width = 800,
    height = 600,
}: PhaserGameProps) {
    const gameRef = useRef<HTMLDivElement>(null);
    const phaserRef = useRef<Phaser.Game | null>(null);
    const sceneRef = useRef<CurvefeverScene | null>(null);

    useEffect(() => {
        if (!gameRef.current) return;
        if (phaserRef.current) return;

        const scene = new CurvefeverScene();
        scene.players = Array.isArray(players) ? players : [];
        sceneRef.current = scene;
        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,
            width,
            height,
            parent: gameRef.current,
            scene,
            physics: { default: "arcade" },
            backgroundColor: "#222",
        };
        phaserRef.current = new Phaser.Game(config);
        return () => {
            phaserRef.current?.destroy(true);
            phaserRef.current = null;
        };
    }, []);

    useEffect(() => {
        // Only update players if scene and playerSprites are ready
        if (sceneRef.current && sceneRef.current.playerSprites) {
            sceneRef.current.updatePlayers(players);
        }
    }, [players]);

    return <div ref={gameRef} style={{ width, height }} />;
}
