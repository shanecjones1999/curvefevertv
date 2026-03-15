import { useState } from "react";
import "./App.css";
import Host from "./Host";
import PlayerController from "./PlayerController";

const ROLE_KEY = "curvefever:role";

function App() {
    const [role, setRole] = useState<"none" | "host" | "phone">(() => {
        const stored = localStorage.getItem(ROLE_KEY);
        if (stored === "host" || stored === "phone") return stored;
        return "none";
    });

    function selectRole(nextRole: "host" | "phone") {
        setRole(nextRole);
        localStorage.setItem(ROLE_KEY, nextRole);
    }

    function clearRole() {
        setRole("none");
        localStorage.removeItem(ROLE_KEY);
    }

    if (role === "host") return <Host onLeave={clearRole} />;
    if (role === "phone") return <PlayerController onLeave={clearRole} />;

    return (
        <main className="page-shell">
            <section className="panel role-panel">
                <div className="brand-row">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 64 64"
                        role="img"
                        aria-label="Curvefever logo"
                        className="brand-logo"
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
                    <p className="eyebrow brand-text">Curvefever TV</p>
                </div>
                <h1 className="title">Select Your Role</h1>
                <p className="subtitle">
                    Host on the big screen or use your phone as a controller.
                </p>
                <div className="role-grid">
                    <button
                        className="ui-button"
                        onClick={() => selectRole("host")}
                    >
                        Host Game
                    </button>
                    <button
                        className="ui-button ui-button-secondary"
                        onClick={() => selectRole("phone")}
                    >
                        Phone Controller
                    </button>
                </div>
            </section>
        </main>
    );
}

export default App;
