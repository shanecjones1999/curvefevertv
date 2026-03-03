import { useState } from "react";
import "./App.css";
import Host from "./Host";
import Phone from "./Phone";

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
    if (role === "phone") return <Phone onLeave={clearRole} />;

    return (
        <div style={{ padding: 24 }}>
            <h1>Curvefever — Select Role</h1>
            <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => selectRole("host")}>Host (TV)</button>
                <button onClick={() => selectRole("phone")}>
                    Phone (Controller)
                </button>
            </div>
        </div>
    );
}

export default App;
