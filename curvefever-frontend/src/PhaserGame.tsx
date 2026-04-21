import { useEffect, useRef } from "react";
import Phaser from "phaser";
import type { GameMode, Player } from "./types";
import styles from "./ui.module.css";
import { cx } from "./utils/cx";
import {
    DEFAULT_GAME_HEIGHT,
    DEFAULT_GAME_WIDTH,
    PLAYER_HEAD_GLOW_ALPHA,
    PLAYER_HEAD_GLOW_RADIUS,
    PLAYER_HEAD_PULSE_ALPHA_VARIATION,
    PLAYER_HEAD_PULSE_RADIUS_VARIATION,
    PLAYER_HEAD_PULSE_SPEED,
    PLAYER_HEAD_RADIUS,
    PLAYER_TRAIL_WIDTH,
} from "./gameConfig";
import { PLAYER_COLORS } from "./constants/gameUi";
import {
    getTeamColor,
    getTeamLabel,
    getTeamSymbol,
} from "./utils/teamMode";
import { getSharedAudioContext } from "./utils/audioContext";

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
    playerAliveStates: Map<string, boolean> = new Map();
    audioContext: AudioContext | null = null;

    constructor() {
        super("CurvefeverScene");
    }

    getPlayerColor(player: Player, index: number) {
        return player.color && /^#/.test(player.color)
            ? player.color
            : PLAYER_COLORS[index % PLAYER_COLORS.length];
    }

    getPulseOffset(playerId: string) {
        let hash = 0;
        for (let index = 0; index < playerId.length; index += 1) {
            hash = (hash * 31 + playerId.charCodeAt(index)) % 360;
        }

        return Phaser.Math.DegToRad(hash);
    }

    drawPlayerHead(
        graphic: Phaser.GameObjects.Graphics,
        player: Player,
        color: string,
        time = 0,
    ) {
        const colorValue = Phaser.Display.Color.HexStringToColor(color).color;
        const pulse =
            (Math.sin(time * PLAYER_HEAD_PULSE_SPEED + this.getPulseOffset(player.id)) +
                1) /
            2;
        const glowRadius =
            PLAYER_HEAD_GLOW_RADIUS + pulse * PLAYER_HEAD_PULSE_RADIUS_VARIATION;
        const glowAlpha =
            PLAYER_HEAD_GLOW_ALPHA + pulse * PLAYER_HEAD_PULSE_ALPHA_VARIATION;

        graphic.clear();
        graphic.fillStyle(colorValue, glowAlpha);
        graphic.fillCircle(0, 0, glowRadius);
        graphic.fillStyle(colorValue, 1);
        graphic.fillCircle(0, 0, PLAYER_HEAD_RADIUS);
        graphic.x = player.x;
        graphic.y = player.y;
        graphic.setVisible(true);
    }

    renderPlayerHeads(time = 0) {
        this.players.forEach((player, index) => {
            const graphic = this.playerSprites.get(player.id);
            if (!graphic) {
                return;
            }

            if (!player.alive) {
                graphic.setVisible(false);
                return;
            }

            this.drawPlayerHead(graphic, player, this.getPlayerColor(player, index), time);
        });
    }

    playCrashSound() {
        const context = getSharedAudioContext();
        if (!context) {
            return;
        }
        this.audioContext = context;
        const now = context.currentTime;
        const masterGain = context.createGain();
        const bodyGain = context.createGain();
        const biteGain = context.createGain();
        const bodyOscillator = context.createOscillator();
        const biteOscillator = context.createOscillator();
        const filter = context.createBiquadFilter();

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1200, now);
        filter.Q.setValueAtTime(1.2, now);

        masterGain.gain.setValueAtTime(0.0001, now);
        masterGain.gain.exponentialRampToValueAtTime(0.12, now + 0.012);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);

        bodyGain.gain.setValueAtTime(1, now);
        biteGain.gain.setValueAtTime(0.55, now);
        biteGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

        bodyOscillator.type = "triangle";
        bodyOscillator.frequency.setValueAtTime(210, now);
        bodyOscillator.frequency.exponentialRampToValueAtTime(78, now + 0.19);

        biteOscillator.type = "square";
        biteOscillator.frequency.setValueAtTime(640, now);
        biteOscillator.frequency.exponentialRampToValueAtTime(140, now + 0.09);

        bodyOscillator.connect(bodyGain);
        biteOscillator.connect(biteGain);
        bodyGain.connect(filter);
        biteGain.connect(filter);
        filter.connect(masterGain);
        masterGain.connect(context.destination);

        bodyOscillator.start(now);
        biteOscillator.start(now);
        bodyOscillator.stop(now + 0.19);
        biteOscillator.stop(now + 0.09);

        bodyOscillator.onended = () => {
            bodyOscillator.disconnect();
            biteOscillator.disconnect();
            bodyGain.disconnect();
            biteGain.disconnect();
            filter.disconnect();
            masterGain.disconnect();
        };
    }

    create() {
        this.playerSprites.clear();
        this.markerTexts.clear();
        this.playerLabels.clear();
        this.playerAliveStates.clear();
        this.cameras.main.setBackgroundColor("#222");
        // Defensive: always use array
        const players = Array.isArray(this.players) ? this.players : [];
        players.forEach((p, i) => {
            const g = this.add.graphics();
            this.drawPlayerHead(g, p, this.getPlayerColor(p, i));
            this.playerSprites.set(p.id, g);
        });
    }

    playEliminationEffect(player: Player, color: string) {
        this.playCrashSound();
        const baseColor = Phaser.Display.Color.HexStringToColor(color);
        const colorValue = baseColor.color;
        const flashColor = Phaser.Display.Color.Interpolate.ColorWithColor(
            baseColor,
            new Phaser.Display.Color(255, 255, 255),
            100,
            45,
        );
        const flashColorValue = Phaser.Display.Color.GetColor(
            flashColor.r,
            flashColor.g,
            flashColor.b,
        );
        const flash = this.add.circle(player.x, player.y, 5, flashColorValue, 0.95);
        const poof = this.add.circle(player.x, player.y, 8, colorValue, 0.28);
        const ring = this.add.circle(player.x, player.y, 11);
        ring.setStrokeStyle(2, colorValue, 0.9);

        this.tweens.add({
            targets: flash,
            scale: { from: 0.6, to: 1.7 },
            alpha: { from: 0.95, to: 0 },
            duration: 120,
            ease: "Quad.easeOut",
            onComplete: () => flash.destroy(),
        });

        this.tweens.add({
            targets: [poof, ring],
            scale: { from: 0.8, to: 1.9 },
            alpha: { from: 1, to: 0 },
            duration: 240,
            ease: "Cubic.easeOut",
            onComplete: () => {
                poof.destroy();
                ring.destroy();
            },
        });

        const fragmentCount = Phaser.Math.Between(6, 10);
        for (let index = 0; index < fragmentCount; index += 1) {
            const angle =
                (Math.PI * 2 * index) / fragmentCount +
                Phaser.Math.FloatBetween(-0.2, 0.2);
            const distance = Phaser.Math.Between(14, 28);
            const fragment = this.add.circle(
                player.x,
                player.y,
                Phaser.Math.FloatBetween(1.5, 3.5),
                colorValue,
                0.95,
            );

            this.tweens.add({
                targets: fragment,
                x: player.x + Math.cos(angle) * distance,
                y: player.y + Math.sin(angle) * distance,
                alpha: 0,
                scale: { from: 1, to: 0.4 },
                duration: Phaser.Math.Between(180, 280),
                ease: "Cubic.easeOut",
                onComplete: () => fragment.destroy(),
            });
        }

        const sparkCount = Phaser.Math.Between(3, 5);
        for (let index = 0; index < sparkCount; index += 1) {
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const sparkLength = Phaser.Math.Between(12, 20);
            const spark = this.add.rectangle(
                player.x,
                player.y,
                sparkLength,
                2,
                flashColorValue,
                0.9,
            );
            spark.setRotation(angle);

            this.tweens.add({
                targets: spark,
                x: player.x + Math.cos(angle) * Phaser.Math.Between(10, 16),
                y: player.y + Math.sin(angle) * Phaser.Math.Between(10, 16),
                alpha: 0,
                scaleX: 0.35,
                scaleY: 0.6,
                duration: Phaser.Math.Between(120, 180),
                ease: "Quad.easeOut",
                onComplete: () => spark.destroy(),
            });
        }

        const skull = this.add.container(player.x, player.y - 10);
        const skullOutlineColor = 0x041122;
        const skullFillColor = 0xf6fbff;

        const crossboneLeft = this.add.rectangle(-5, 8, 11, 2, skullOutlineColor);
        crossboneLeft.setRotation(-0.7);
        const crossboneLeftInner = this.add.rectangle(-5, 8, 8, 1, skullFillColor);
        crossboneLeftInner.setRotation(-0.7);

        const crossboneRight = this.add.rectangle(5, 8, 11, 2, skullOutlineColor);
        crossboneRight.setRotation(0.7);
        const crossboneRightInner = this.add.rectangle(5, 8, 8, 1, skullFillColor);
        crossboneRightInner.setRotation(0.7);

        const headOutline = this.add.circle(0, 0, 8, skullOutlineColor, 1);
        const headFill = this.add.circle(0, 0, 6, skullFillColor, 1);
        const jawOutline = this.add.rectangle(0, 6, 10, 5, skullOutlineColor, 1);
        const jawFill = this.add.rectangle(0, 6, 7, 3, skullFillColor, 1);
        const eyeLeft = this.add.circle(-3, -1, 1.5, skullOutlineColor, 1);
        const eyeRight = this.add.circle(3, -1, 1.5, skullOutlineColor, 1);
        const nose = this.add.triangle(0, 2.5, 0, 0, 2.2, 3, -2.2, 3, skullOutlineColor, 1);

        skull.add([
            crossboneLeft,
            crossboneLeftInner,
            crossboneRight,
            crossboneRightInner,
            headOutline,
            headFill,
            jawOutline,
            jawFill,
            eyeLeft,
            eyeRight,
            nose,
        ]);

        this.tweens.add({
            targets: skull,
            y: player.y - 40,
            alpha: 0,
            scale: { from: 0.9, to: 1.08 },
            angle: Phaser.Math.Between(-10, 10),
            duration: 1200,
            ease: "Sine.easeOut",
            onComplete: () => skull.destroy(),
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
        const previousAliveStates = new Map(this.playerAliveStates);

        const incomingPlayerIds = new Set(
            this.players.map((player) => player.id),
        );

        for (const [key, graphic] of this.playerSprites.entries()) {
            const playerId = key.replace(/_trail$/, "");
            if (!incomingPlayerIds.has(playerId)) {
                graphic.destroy();
                this.playerSprites.delete(key);
                this.playerAliveStates.delete(playerId);
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
            const color = this.getPlayerColor(p, i);
            const becameEliminated =
                previousAliveStates.get(p.id) === true && !p.alive;

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
            if (p.alive) {
                this.drawPlayerHead(g, p, color, this.time.now);
            } else {
                g.setVisible(false);
            }

            if (this.teamMode && typeof p.teamId === "number" && p.alive) {
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

            if (becameEliminated) {
                this.playEliminationEffect(p, color);
            }

            this.playerAliveStates.set(p.id, p.alive);
        });
    }

    update(time: number) {
        this.renderPlayerHeads(time);
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
