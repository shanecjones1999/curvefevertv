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
                <p className="eyebrow">Curvefever TV</p>
                <h1 className="title">Select Your Role</h1>
                <p className="subtitle">
                    Host on the big screen or use your phone as a controller.
                </p>
                <div className="role-grid">
                    <button
                        className="ui-button"
                        onClick={() => selectRole("host")}
                    >
                        Host Display
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
