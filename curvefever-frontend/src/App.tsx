import { useEffect, useState } from "react";
import "./App.css";
import styles from "./App.module.css";
import Host from "./Host";
import PlayerController from "./PlayerController";
import { getRequestedRoleFromUrl } from "./utils/joinLink";

const ROLE_KEY = "curvefever:role";

function App() {
    const [role, setRole] = useState<"none" | "host" | "phone">(() => {
        const requestedRole = getRequestedRoleFromUrl();
        if (requestedRole) return requestedRole;

        const stored = localStorage.getItem(ROLE_KEY);
        if (stored === "host" || stored === "phone") return stored;
        return "none";
    });

    useEffect(() => {
        if (role === "none") {
            localStorage.removeItem(ROLE_KEY);
            return;
        }

        localStorage.setItem(ROLE_KEY, role);
    }, [role]);

    function selectRole(nextRole: "host" | "phone") {
        setRole(nextRole);
    }

    function clearRole() {
        setRole("none");
    }

    if (role === "host") return <Host onLeave={clearRole} />;
    if (role === "phone") return <PlayerController onLeave={clearRole} />;

    return (
        <main className="page-shell page-shell-landing">
            <section className={`panel role-panel ${styles.landingHeroPanel}`}>
                <div className={styles.landingHeroGrid}>
                    <div className={styles.landingCopy}>
                        <div className={styles.brandRow}>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 64 64"
                                role="img"
                                aria-label="Curvefever logo"
                                className={styles.brandLogo}
                            >
                                <defs>
                                    <radialGradient
                                        id="brand-bg"
                                        cx="50%"
                                        cy="25%"
                                        r="85%"
                                    >
                                        <stop offset="0%" stopColor="#1c2d66" />
                                        <stop offset="100%" stopColor="#070c1f" />
                                    </radialGradient>
                                    <linearGradient
                                        id="brand-trail-a"
                                        x1="0"
                                        y1="0"
                                        x2="1"
                                        y2="1"
                                    >
                                        <stop offset="0%" stopColor="#5cf6ff" />
                                        <stop offset="100%" stopColor="#2c76ff" />
                                    </linearGradient>
                                    <linearGradient
                                        id="brand-trail-b"
                                        x1="1"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                    >
                                        <stop offset="0%" stopColor="#ff66c4" />
                                        <stop offset="100%" stopColor="#ff934f" />
                                    </linearGradient>
                                </defs>
                                <rect
                                    x="2"
                                    y="2"
                                    width="60"
                                    height="60"
                                    rx="14"
                                    fill="url(#brand-bg)"
                                    stroke="#395fbf"
                                    strokeWidth="2"
                                />
                                <path
                                    d="M14 44C14 30 24 20 35 20c8 0 15 4 18 11"
                                    fill="none"
                                    stroke="url(#brand-trail-a)"
                                    strokeWidth="5"
                                    strokeLinecap="round"
                                />
                                <path
                                    d="M50 22c0 12-8 22-20 22-6 0-11-2-15-6"
                                    fill="none"
                                    stroke="url(#brand-trail-b)"
                                    strokeWidth="5"
                                    strokeLinecap="round"
                                />
                                <circle cx="53" cy="32" r="4" fill="#61f7ff" />
                                <circle cx="17" cy="38" r="3.5" fill="#ff7ccf" />
                            </svg>
                            <div className={styles.landingBrandBlock}>
                                <p className={`eyebrow ${styles.brandText}`}>Curvefever TV</p>
                                <p className={styles.landingKicker}>
                                    Arcade party racing for one big screen and a
                                    room full of phones
                                </p>
                            </div>
                        </div>
                        <h1 className={`title ${styles.landingTitle}`}>
                            Run the room. Hand everyone a controller.
                        </h1>
                        <p className={`subtitle ${styles.landingSubtitle}`}>
                            Host the arena on the TV, let players join in seconds,
                            and turn every match into a polished couch-competition
                            moment.
                        </p>
                        <div className={styles.landingHighlightRow} aria-label="Product highlights">
                            <span className={styles.landingHighlightPill}>
                                Fast room-code join
                            </span>
                            <span className={styles.landingHighlightPill}>
                                Mobile-first controls
                            </span>
                            <span className={styles.landingHighlightPill}>
                                Built for party play
                            </span>
                        </div>
                    </div>

                    <div className={styles.landingPreviewStack} aria-hidden="true">
                        <article className={`${styles.landingPreviewCard} ${styles.landingPreviewCardHost}`}>
                            <span className={styles.landingPreviewLabel}>Host screen</span>
                            <strong className={styles.landingPreviewTitle}>
                                Command-center lobby
                            </strong>
                            <div className={styles.landingPreviewCode}>ABCD</div>
                            <div className={styles.landingPreviewPlayers}>
                                <span>4 players connected</span>
                                <span>Classic mode</span>
                            </div>
                        </article>
                        <article className={`${styles.landingPreviewCard} ${styles.landingPreviewCardPhone}`}>
                            <span className={styles.landingPreviewLabel}>Phone controller</span>
                            <strong className={styles.landingPreviewTitle}>
                                Join, hold, and steer
                            </strong>
                            <div className={styles.landingPreviewControls}>
                                <span>Turn Left</span>
                                <span>Turn Right</span>
                            </div>
                            <p className={styles.landingPreviewCopy}>
                                Quick to join, clear to use, and ready for every
                                round.
                            </p>
                        </article>
                    </div>
                </div>

                <div className={styles.landingRoleGrid}>
                    <button
                        className={`${styles.landingRoleCard} ${styles.landingRoleCardPrimary}`}
                        onClick={() => selectRole("host")}
                    >
                        <span className={styles.landingRoleEyebrow}>Big screen</span>
                        <strong className={styles.landingRoleTitle}>Host a game</strong>
                        <span className={styles.landingRoleCopy}>
                            Create the room, pick the mode, and run the match from
                            the TV or laptop.
                        </span>
                        <span className={styles.landingRoleMeta}>Best for the display device</span>
                    </button>
                    <button
                        className={styles.landingRoleCard}
                        onClick={() => selectRole("phone")}
                    >
                        <span className={styles.landingRoleEyebrow}>Phone controller</span>
                        <strong className={styles.landingRoleTitle}>Join as player</strong>
                        <span className={styles.landingRoleCopy}>
                            Enter the room code and turn your phone into a dedicated
                            controller.
                        </span>
                        <span className={styles.landingRoleMeta}>Best for everyone joining in</span>
                    </button>
                </div>
            </section>
            <footer className={styles.landingFooter} aria-label="Project links">
                <a
                    className={styles.landingFooterLink}
                    href="https://github.com/shanecjones1999/curvefevertv"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="View source on GitHub"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        role="img"
                        aria-hidden="true"
                        className={styles.landingFooterIcon}
                    >
                        <path
                            fill="currentColor"
                            d="M12 .5a12 12 0 0 0-3.79 23.39c.6.1.82-.26.82-.58v-2.03c-3.34.73-4.04-1.6-4.04-1.6-.55-1.38-1.33-1.75-1.33-1.75-1.1-.75.08-.73.08-.73 1.2.08 1.83 1.23 1.83 1.23 1.08 1.83 2.83 1.3 3.52.99.1-.77.42-1.3.77-1.6-2.67-.3-5.47-1.33-5.47-5.95 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.53.12-3.2 0 0 1.01-.32 3.3 1.23a11.53 11.53 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.65 1.67.24 2.9.12 3.2.77.84 1.23 1.91 1.23 3.22 0 4.63-2.8 5.65-5.48 5.95.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.58A12 12 0 0 0 12 .5Z"
                        />
                    </svg>
                    <span>GitHub</span>
                </a>
            </footer>
        </main>
    );
}

export default App;
