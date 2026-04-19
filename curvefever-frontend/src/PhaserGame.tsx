import { useEffect, useRef } from "react";
import Phaser from "phaser";
import type { GameMode, Player } from "./types";
import styles from "./ui.module.css";
import { cx } from "./utils/cx";
import {
    DEFAULT_GAME_HEIGHT,
    DEFAULT_GAME_WIDTH,
    PLAYER_TRAIL_WIDTH,
} from "./gameConfig";
import { PLAYER_COLORS } from "./constants/gameUi";
import {
    getTeamColor,
    getTeamLabel,
    getTeamSymbol,
} from "./utils/teamMode";

interface PhaserGameProps {
    players: Player[];
    gameMode?: GameMode;
    showTeamLabels?: boolean;
    width?: number;
    height?: number;
    className?: string;
}

class CurvefeverScene extends Phaser.Scene {
    players: Player[] = [];
    playerSprites: Map<string, Phaser.GameObjects.Graphics> = new Map();
    teamMode = false;
    showTeamLabels = false;
    markerTexts: Map<string, Phaser.GameObjects.Text> = new Map();
    playerLabels: Map<string, Phaser.GameObjects.Text> = new Map();

    constructor() {
        super("CurvefeverScene");
    }

    create() {
        this.playerSprites.clear();
        this.markerTexts.clear();
        this.playerLabels.clear();
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

    setPlayers(players: Player[] = []) {
        this.players = Array.isArray(players) ? players : [];
        // Do not call updatePlayers here; let React effect call it after scene is ready
    }

    setDisplayMode(gameMode?: GameMode, showTeamLabels = false) {
        this.teamMode = gameMode === "teams";
        this.showTeamLabels = showTeamLabels;
    }

    updatePlayers(players: Player[] = []) {
        if (!this.add) return;
        this.players = Array.isArray(players) ? players : [];

        const incomingPlayerIds = new Set(
            this.players.map((player) => player.id),
        );

        for (const [key, graphic] of this.playerSprites.entries()) {
            const playerId = key.replace(/_trail$/, "");
            if (!incomingPlayerIds.has(playerId)) {
                graphic.destroy();
                this.playerSprites.delete(key);
            }
        }
        for (const [playerId, markerText] of this.markerTexts.entries()) {
            if (!incomingPlayerIds.has(playerId)) {
                markerText.destroy();
                this.markerTexts.delete(playerId);
            }
        }
        for (const [playerId, playerLabel] of this.playerLabels.entries()) {
            if (!incomingPlayerIds.has(playerId)) {
                playerLabel.destroy();
                this.playerLabels.delete(playerId);
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

            if (this.teamMode && typeof p.teamId === "number") {
                let markerText = this.markerTexts.get(p.id);
                if (!markerText) {
                    markerText = this.add.text(0, 0, "", {
                        color: getTeamColor(p.teamId),
                        fontFamily:
                            '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                        fontSize: "18px",
                        fontStyle: "700",
                        stroke: "#041122",
                        strokeThickness: 4,
                    });
                    markerText.setOrigin(0.5, 1);
                    this.markerTexts.set(p.id, markerText);
                }
                markerText.setText(getTeamSymbol(p.teamId));
                markerText.setColor(getTeamColor(p.teamId));
                markerText.setPosition(p.x, p.y - 14);
                markerText.setVisible(true);

                let playerLabel = this.playerLabels.get(p.id);
                if (!playerLabel) {
                    playerLabel = this.add.text(0, 0, "", {
                        color: "#eef6ff",
                        fontFamily:
                            '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                        fontSize: "12px",
                        fontStyle: "600",
                        align: "center",
                        stroke: "#041122",
                        strokeThickness: 4,
                    });
                    playerLabel.setOrigin(0.5, 1);
                    this.playerLabels.set(p.id, playerLabel);
                }
                playerLabel.setText(
                    `${p.name} ${getTeamSymbol(p.teamId)} ${getTeamLabel(p.teamId)}`,
                );
                playerLabel.setPosition(p.x, p.y - 34);
                playerLabel.setVisible(this.showTeamLabels);
            } else {
                this.markerTexts.get(p.id)?.setVisible(false);
                this.playerLabels.get(p.id)?.setVisible(false);
            }
        });
    }

    update() {
        // No-op: all updates are handled via updatePlayers
    }
}

export default function PhaserGame({
    players,
    gameMode,
    showTeamLabels = false,
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
        if (sceneRef.current) {
            sceneRef.current.setDisplayMode(gameMode, showTeamLabels);
            sceneRef.current.updatePlayers(players);
        }
    }, [gameMode, players, showTeamLabels]);

    return (
        <div className={cx(styles["phaser-shell"], className)}>
            <div ref={gameRef} className={styles["phaser-host"]} />
        </div>
    );
}
