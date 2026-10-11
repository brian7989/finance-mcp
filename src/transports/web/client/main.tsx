import { createRoot } from "react-dom/client";
import type { ConnectionsData } from "../connections-types";
import { ConnectionsPage } from "./features/connections/page";
import "./styles.css";

function mountConnections(): void {
  const container = document.getElementById("app");
  const payload = document.getElementById("connections-data");
  if (!container || !payload?.textContent) {
    return;
  }
  try {
    const data = JSON.parse(payload.textContent) as ConnectionsData;
    createRoot(container).render(<ConnectionsPage data={data} />);
  } catch {
    container.textContent = "Unable to load your connections. Reload this page to try again.";
  }
}
mountConnections();
