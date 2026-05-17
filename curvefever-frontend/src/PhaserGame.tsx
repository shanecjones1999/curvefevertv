import { useEffect, useRef } from "react";
import Phaser from "phaser";
import type { ClientLagDiagnostics, GameMode, Player } from "./types";
import styles from "./ui.module.css";
import { cx } from "./utils/cx";
import {
    DEFAULT_GAME_HEIGHT,
    DEFAULT_GAME_WIDTH,
    PLAYER_HEAD_GLOW_ALPHA,
    PLAYER_HEAD_GLOW_RADIUS,
    PLAYER_HEAD_RADIUS,
    PLAYER_TRAIL_WIDTH,
} from "./gameConfig";
import { PLAYER_COLORS } from "./constants/gameUi";
import {
    getTeamColor,
    getTeamLabel,
    getTeamSymbol,
} from "./utils/teamMode";
import { playSoundEffect } from "./utils/soundEffects";

interface PhaserGameProps {
    players: Player[];
    livePlayersRef?: React.MutableRefObject<Player[]>;
    gameMode?: GameMode;
    showTeamLabels?: boolean;
    width?: number;
    height?: number;
    className?: string;
    onClientLagDiagnostics?: (
        diagnostics: ClientLagDiagnostics | null,
    ) => void;
}

class CurvefeverScene extends Phaser.Scene {
    players: Player[] = [];
    playerSprites: Map<string, Phaser.GameObjects.Graphics> = new Map();
    trailLayer: Phaser.GameObjects.RenderTexture | null = null;
    trailStamp: Phaser.GameObjects.Graphics | null = null;
    teamMode = false;
    showTeamLabels = false;
    markerTexts: Map<string, Phaser.GameObjects.Text> = new Map();
    playerLabels: Map<string, Phaser.GameObjects.Text> = new Map();
    playerAliveStates: Map<string, boolean> = new Map();
    playerHeadRenderStates: Map<string, { colorValue: number }> = new Map();
    playerColorValueCache: Map<string, { color: string; colorValue: number }> =
        new Map();
    trailRenderStates: Map<
        string,
        { segmentLengths: number[]; color: string }
    > = new Map();
    livePlayersSourceRef: React.MutableRefObject<Player[]> | null = null;
    fallbackPlayersSourceRef: React.MutableRefObject<Player[]> | null = null;
    lastRenderedPlayers: Player[] | null = null;
    clientLagDiagnosticsHandler:
        | ((diagnostics: ClientLagDiagnostics | null) => void)
        | null = null;
    frameDurationSamples: number[] = [];
    lastFrameAt: number | null = null;
    lastClientLagEmitAt = 0;

    constructor() {
        super("CurvefeverScene");
    }

    getPlayerColor(player: Player, index: number) {
        return player.color && /^#/.test(player.color)
            ? player.color
            : PLAYER_COLORS[index % PLAYER_COLORS.length];
    }

    drawPlayerHead(
        graphic: Phaser.GameObjects.Graphics,
        player: Player,
        playerId: string,
        colorValue: number,
    ) {
        const previousRenderState = this.playerHeadRenderStates.get(playerId);
        if (
            !previousRenderState ||
            previousRenderState.colorValue !== colorValue
        ) {
            graphic.clear();
            graphic.fillStyle(colorValue, PLAYER_HEAD_GLOW_ALPHA);
            graphic.fillCircle(0, 0, PLAYER_HEAD_GLOW_RADIUS);
            graphic.fillStyle(colorValue, 1);
            graphic.fillCircle(0, 0, PLAYER_HEAD_RADIUS);
            this.playerHeadRenderStates.set(playerId, {
                colorValue,
            });
        }

        graphic.x = player.x;
        graphic.y = player.y;
        graphic.setVisible(true);
    }

    getColorValue(playerId: string, color: string) {
        const previousColorValue = this.playerColorValueCache.get(playerId);
        if (previousColorValue && previousColorValue.color === color) {
            return previousColorValue.colorValue;
        }

        const colorValue = Phaser.Display.Color.HexStringToColor(color).color;
        this.playerColorValueCache.set(playerId, {
            color,
            colorValue,
        });
        return colorValue;
    }

    getHeadColorValue(playerId: string, color: string) {
        return this.getColorValue(playerId, color);
    }

    create() {
        this.playerSprites.clear();
        this.markerTexts.clear();
        this.playerLabels.clear();
        this.playerAliveStates.clear();
        this.playerHeadRenderStates.clear();
        this.playerColorValueCache.clear();
        this.trailRenderStates.clear();
        this.lastRenderedPlayers = null;
        this.frameDurationSamples = [];
        this.lastFrameAt = null;
        this.lastClientLagEmitAt = 0;
        this.cameras.main.setBackgroundColor("#222");
        this.trailLayer = this.add.renderTexture(
            0,
            0,
            this.scale.gameSize.width,
            this.scale.gameSize.height,
        );
        this.trailLayer.setOrigin(0, 0);
        this.trailLayer.setDepth(0);
        this.trailLayer.clear();
        this.trailStamp = this.make.graphics(undefined, false);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.trailLayer?.destroy();
            this.trailLayer = null;
            this.trailStamp?.destroy();
            this.trailStamp = null;
        });
        // Defensive: always use array
        const players = Array.isArray(this.players) ? this.players : [];
        players.forEach((p, i) => {
            const g = this.add.graphics();
            g.setDepth(1);
            const color = this.getPlayerColor(p, i);
            const headColorValue = this.getHeadColorValue(p.id, color);
            this.drawPlayerHead(g, p, p.id, headColorValue);
            this.playerSprites.set(p.id, g);
        });
    }

    drawTrailSegments(
        trail: Player["trail"],
        colorValue: number,
        previousSegmentLengths?: number[],
    ) {
        if (!this.trailLayer || !this.trailStamp) return;

        this.trailStamp.clear();
        this.trailStamp.lineStyle(PLAYER_TRAIL_WIDTH, colorValue, 1);

        const segments = Array.isArray(trail) ? trail : [];
        let drewSegment = false;
        for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
            const segment = segments[segmentIndex];
            if (!Array.isArray(segment) || segment.length < 2) continue;
            const previousLength = previousSegmentLengths?.[segmentIndex] ?? 0;
            const startIndex =
                previousSegmentLengths === undefined
                    ? 1
                    : Math.max(1, previousLength);
            if (segment.length <= startIndex) continue;

            this.trailStamp.beginPath();
            this.trailStamp.moveTo(
                segment[startIndex - 1].x,
                segment[startIndex - 1].y,
            );
            for (let pointIndex = startIndex; pointIndex < segment.length; pointIndex += 1) {
                this.trailStamp.lineTo(segment[pointIndex].x, segment[pointIndex].y);
            }
            this.trailStamp.strokePath();
            drewSegment = true;
        }

        if (drewSegment) {
            this.trailLayer.draw(this.trailStamp, 0, 0);
        }

        this.trailStamp.clear();
    }

    redrawTrailLayer(
        trailPlans: Array<{
            player: Player;
            color: string;
            colorValue: number;
            nextSegmentLengths: number[];
            previousTrailState?: { segmentLengths: number[]; color: string };
        }>,
    ) {
        this.trailLayer?.clear();
        for (const trailPlan of trailPlans) {
            this.drawTrailSegments(trailPlan.player.trail, trailPlan.colorValue);
            this.trailRenderStates.set(trailPlan.player.id, {
                segmentLengths: trailPlan.nextSegmentLengths,
                color: trailPlan.color,
            });
        }
    }

    playEliminationEffect(player: Player, colorValue: number) {
        playSoundEffect("crash");
        const rgbColor = Phaser.Display.Color.IntegerToRGB(colorValue);
        const baseColor = new Phaser.Display.Color(
            rgbColor.r,
            rgbColor.g,
            rgbColor.b,
        );
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

    setPlayerSources(
        livePlayersRef?: React.MutableRefObject<Player[]>,
        fallbackPlayersRef?: React.MutableRefObject<Player[]>,
    ) {
        this.livePlayersSourceRef = livePlayersRef ?? null;
        this.fallbackPlayersSourceRef = fallbackPlayersRef ?? null;
    }

    setDisplayMode(gameMode?: GameMode, showTeamLabels = false) {
        this.teamMode = gameMode === "teams";
        this.showTeamLabels = showTeamLabels;
    }

    setClientLagDiagnosticsHandler(
        handler?: (diagnostics: ClientLagDiagnostics | null) => void,
    ) {
        this.clientLagDiagnosticsHandler = handler ?? null;
    }

    updatePlayers(players: Player[] = []) {
        if (!this.add) return;
        this.players = Array.isArray(players) ? players : [];
        const previousAliveStates = new Map(this.playerAliveStates);
        let shouldRedrawAllTrails = false;
        const trailPlans: Array<{
            player: Player;
            color: string;
            colorValue: number;
            nextSegmentLengths: number[];
            previousTrailState?: { segmentLengths: number[]; color: string };
        }> = [];

        const incomingPlayerIds = new Set(
            this.players.map((player) => player.id),
        );

        for (const [playerId, graphic] of this.playerSprites.entries()) {
            if (!incomingPlayerIds.has(playerId)) {
                graphic.destroy();
                this.playerSprites.delete(playerId);
                this.playerAliveStates.delete(playerId);
                this.playerHeadRenderStates.delete(playerId);
                this.playerColorValueCache.delete(playerId);
                this.trailRenderStates.delete(playerId);
                shouldRedrawAllTrails = true;
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
            const color = this.getPlayerColor(p, i);
            const colorValue = this.getColorValue(p.id, color);
            const headColorValue = this.getHeadColorValue(p.id, color);
            const segments = Array.isArray(p.trail) ? p.trail : [];
            const nextSegmentLengths = segments.map((segment) =>
                Array.isArray(segment) ? segment.length : 0,
            );
            const previousTrailState = this.trailRenderStates.get(p.id);
            if (
                previousTrailState &&
                (previousTrailState.color !== color ||
                    nextSegmentLengths.length <
                        previousTrailState.segmentLengths.length ||
                    nextSegmentLengths.some(
                        (length, index) =>
                            length <
                            (previousTrailState.segmentLengths[index] ?? 0),
                    ))
            ) {
                shouldRedrawAllTrails = true;
            }
            trailPlans.push({
                player: p,
                color,
                colorValue,
                nextSegmentLengths,
                previousTrailState,
            });
            const becameEliminated =
                previousAliveStates.get(p.id) === true && !p.alive;

            // Draw player
            let g = this.playerSprites.get(p.id);
            if (!g) {
                g = this.add.graphics();
                g.setDepth(1);
                this.playerSprites.set(p.id, g);
            }
            if (p.alive) {
                this.drawPlayerHead(g, p, p.id, headColorValue);
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
                    markerText.setDepth(2);
                    this.markerTexts.set(p.id, markerText);
                }
                const teamSymbol = getTeamSymbol(p.teamId);
                if (markerText.text !== teamSymbol) {
                    markerText.setText(teamSymbol);
                }
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
                    playerLabel.setDepth(3);
                    this.playerLabels.set(p.id, playerLabel);
                }
                const playerLabelText = `${p.name} ${getTeamSymbol(
                    p.teamId,
                )} ${getTeamLabel(p.teamId)}`;
                if (playerLabel.text !== playerLabelText) {
                    playerLabel.setText(playerLabelText);
                }
                playerLabel.setPosition(p.x, p.y - 34);
                playerLabel.setVisible(this.showTeamLabels);
            } else {
                this.markerTexts.get(p.id)?.setVisible(false);
                this.playerLabels.get(p.id)?.setVisible(false);
            }

            if (becameEliminated) {
                this.playEliminationEffect(p, colorValue);
            }

            this.playerAliveStates.set(p.id, p.alive);
        });

        if (shouldRedrawAllTrails) {
            this.redrawTrailLayer(trailPlans);
            return;
        }

        for (const trailPlan of trailPlans) {
            this.drawTrailSegments(
                trailPlan.player.trail,
                trailPlan.colorValue,
                trailPlan.previousTrailState?.segmentLengths,
            );
            this.trailRenderStates.set(trailPlan.player.id, {
                segmentLengths: trailPlan.nextSegmentLengths,
                color: trailPlan.color,
            });
        }
    }

    update() {
        const now = performance.now();
        if (typeof this.lastFrameAt === "number") {
            const frameDuration = now - this.lastFrameAt;
            this.frameDurationSamples.push(frameDuration);
            if (this.frameDurationSamples.length > 90) {
                this.frameDurationSamples.shift();
            }

            if (
                this.clientLagDiagnosticsHandler &&
                now - this.lastClientLagEmitAt >= 500 &&
                this.frameDurationSamples.length > 0
            ) {
                const frameTimeMs =
                    this.frameDurationSamples.reduce(
                        (sum, sample) => sum + sample,
                        0,
                    ) / this.frameDurationSamples.length;
                const fps = frameTimeMs > 0 ? 1000 / frameTimeMs : 0;
                const slowFrameCount = this.frameDurationSamples.filter(
                    (sample) => sample > 20,
                ).length;
                const slowFramePercent =
                    (slowFrameCount / this.frameDurationSamples.length) * 100;
                this.clientLagDiagnosticsHandler({
                    frameTimeMs,
                    fps,
                    slowFramePercent,
                    sampleCount: this.frameDurationSamples.length,
                });
                this.lastClientLagEmitAt = now;
            }
        }
        this.lastFrameAt = now;

        const nextPlayers =
            this.livePlayersSourceRef?.current ??
            this.fallbackPlayersSourceRef?.current ??
            [];
        if (nextPlayers === this.lastRenderedPlayers) {
            return;
        }

        this.updatePlayers(nextPlayers);
        this.lastRenderedPlayers = nextPlayers;
    }
}

export default function PhaserGame({
    players,
    livePlayersRef,
    gameMode,
    showTeamLabels = false,
    width = DEFAULT_GAME_WIDTH,
    height = DEFAULT_GAME_HEIGHT,
    className,
    onClientLagDiagnostics,
}: PhaserGameProps) {
    const gameRef = useRef<HTMLDivElement>(null);
    const phaserRef = useRef<Phaser.Game | null>(null);
    const sceneRef = useRef<CurvefeverScene | null>(null);
    const fallbackPlayersRef = useRef(players);

    useEffect(() => {
        fallbackPlayersRef.current = players;
    }, [players]);

    useEffect(() => {
        if (!gameRef.current) return;
        if (phaserRef.current) return;

        const scene = new CurvefeverScene();
        scene.setPlayerSources(livePlayersRef, fallbackPlayersRef);
        sceneRef.current = scene;
        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,
            width,
            height,
            parent: gameRef.current,
            scene,
            audio: {
                noAudio: true,
            },
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
    }, [width, height, livePlayersRef]);

    useEffect(() => {
        if (!sceneRef.current) return;
        sceneRef.current.setPlayerSources(livePlayersRef, fallbackPlayersRef);
    }, [livePlayersRef]);

    useEffect(() => {
        if (!sceneRef.current) return;
        sceneRef.current.setClientLagDiagnosticsHandler(onClientLagDiagnostics);
    }, [onClientLagDiagnostics]);

    useEffect(() => {
        if (sceneRef.current) {
            sceneRef.current.setDisplayMode(gameMode, showTeamLabels);
        }
    }, [gameMode, showTeamLabels]);

    return (
        <div className={cx(styles["phaser-shell"], className)}>
            <div ref={gameRef} className={styles["phaser-host"]} />
        </div>
    );
}
