import { useState } from "react";
import "./App.css";
import Host from "./Host";
import Phone from "./Phone";

function App() {
    const [role, setRole] = useState<"none" | "host" | "phone">("none");

    if (role === "host") return <Host />;
    if (role === "phone") return <Phone />;

    return (
        <div style={{ padding: 24 }}>
            <h1>Curvefever — Select Role</h1>
            <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setRole("host")}>Host (TV)</button>
                <button onClick={() => setRole("phone")}>
                    Phone (Controller)
                </button>
            </div>
        </div>
    );
}

export default App;
