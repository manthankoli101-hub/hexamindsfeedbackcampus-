// Severity Map: renders the campus floorplan (Leaflet + image overlay),
// draws every room as a clickable polygon (from CAMPUS_LOCATIONS' rect),
// and drops a colored dot at each room's center reflecting only that
// room's single highest-severity active issue. Clicking a room (polygon
// or dot) opens a right-hand sidebar listing every active issue grouped
// at that location. Re-run loadMap() (e.g. after visiting report.html)
// and newly submitted complaints will appear.

const SEVERITY_COLOR = {
  1: "#4d9c5d", // green  - low
  2: "#c8a52d", // yellow - moderate
  3: "#e58b31", // orange - high
  4: "#c83d3d"  // red    - hazardous
};
const NO_REPORT_COLOR = "#9aa7b5"; // grey - no active reports at this spot

const ROOM_STYLE = { color: "#2b6cff", weight: 0, opacity: 0, fillColor: "#2b6cff", fillOpacity: 0 };
const ROOM_HOVER_STYLE = { color: "#2b6cff", weight: 2, opacity: 0.8, fillColor: "#2b6cff", fillOpacity: 0.18 };

function configureMapNavigation() {
  const user = JSON.parse(localStorage.getItem("campus_user") || "null");
  const brand = document.getElementById("mapBrand");
  const dashboard = document.getElementById("mapDashboard");
  const target = user?.role === "admin" ? "admin.html" : "student-dashboard.html";
  brand.href = target;
  dashboard.href = target;
  dashboard.textContent = "Dashboard";
}

// Convert a pixel coordinate (x, y from the top-left of the floorplan
// image, same as you'd read off in an image editor) into a Leaflet latlng.
function toLatLng(x, y) {
  return [FLOORPLAN_IMG_HEIGHT - y, x];
}

function ring(rect) {
  const [x1, y1, x2, y2] = rect;
  return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]].map(([x, y]) => toLatLng(x, y));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------------------------------------------------------------------
// Sidebar: slides in from the right, lists every active issue grouped
// at the clicked room.
// ---------------------------------------------------------------------

function ensureSidebar() {
  let sidebar = document.getElementById("roomSidebar");
  if (sidebar) return sidebar;

  sidebar = document.createElement("aside");
  sidebar.id = "roomSidebar";
  sidebar.className = "room-sidebar";
  sidebar.innerHTML = `
    <div class="room-sidebar-head">
      <div>
        <p class="eyebrow" id="roomSidebarEyebrow">ROOM</p>
        <h3 id="roomSidebarTitle">&nbsp;</h3>
      </div>
      <button type="button" class="room-sidebar-close" id="roomSidebarClose" aria-label="Close">&times;</button>
    </div>
    <p class="muted small" id="roomSidebarNote"></p>
    <div id="roomSidebarBody" class="room-sidebar-body"></div>
  `;
  document.body.appendChild(sidebar);

  const backdrop = document.createElement("div");
  backdrop.id = "roomSidebarBackdrop";
  backdrop.className = "room-sidebar-backdrop";
  document.body.appendChild(backdrop);

  const close = () => closeSidebar();
  document.getElementById("roomSidebarClose").addEventListener("click", close);
  backdrop.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  return sidebar;
}

function closeSidebar() {
  document.getElementById("roomSidebar")?.classList.remove("open");
  document.getElementById("roomSidebarBackdrop")?.classList.remove("open");
}

function issueRowHtml(issue) {
  return `
    <a class="issue-row" href="issue?id=${encodeURIComponent(issue.id)}">
      <div>
        <strong>${escapeHtml(issue.title)}</strong>
        <small>${issue.duplicateCount} report${issue.duplicateCount === 1 ? "" : "s"} &middot; ${escapeHtml(issue.department)} &middot; ${escapeHtml(issue.status)}</small>
      </div>
      <div class="row-right">
        <span class="badge p${issue.priority}">P${issue.priority}</span>
        <span><i class="dot" style="background:${SEVERITY_COLOR[issue.severity] || NO_REPORT_COLOR}"></i> ${issue.severity}/4</span>
      </div>
    </a>`;
}

function openSidebarForRoom(location, roomIssues) {
  const sidebar = ensureSidebar();
  document.getElementById("roomSidebarTitle").textContent = location.name;
  document.getElementById("roomSidebarNote").textContent = location.note || "";

  const active = roomIssues.filter((i) => i.status !== "Resolved");
  const resolved = roomIssues.filter((i) => i.status === "Resolved");

  document.getElementById("roomSidebarEyebrow").textContent =
    active.length ? `${active.length} ACTIVE ISSUE${active.length === 1 ? "" : "S"}` : "NO ACTIVE ISSUES";

  const body = document.getElementById("roomSidebarBody");
  if (!roomIssues.length) {
    body.innerHTML = `<div class="empty-state">No complaints reported here.</div>`;
  } else {
    body.innerHTML = `
      ${active.length ? `<div class="issue-list">${active.map(issueRowHtml).join("")}</div>` : `<div class="empty-state">No active complaints reported here.</div>`}
      ${resolved.length ? `
        <p class="eyebrow room-sidebar-subhead">RESOLVED</p>
        <div class="issue-list">${resolved.map(issueRowHtml).join("")}</div>
      ` : ""}
      <a class="btn btn-primary room-sidebar-report" href="report.html">Report an issue here</a>
    `;
  }

  sidebar.classList.add("open");
  document.getElementById("roomSidebarBackdrop").classList.add("open");
}

// ---------------------------------------------------------------------
// Map rendering
// ---------------------------------------------------------------------

async function loadMap() {
  const errorBox = document.getElementById("mapError");
  errorBox.textContent = "";
  ensureSidebar();

  const map = L.map("floorMap", {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 5,
    zoomSnap: 0.25
  });

  const bounds = [[0, 0], [FLOORPLAN_IMG_HEIGHT, FLOORPLAN_IMG_WIDTH]];
  L.imageOverlay(FLOORPLAN_IMAGE, bounds).addTo(map);
  map.fitBounds(bounds);
  map.setMaxBounds(bounds);

  let issues = [];
  try {
    issues = await API.getIssues();
  } catch (error) {
    errorBox.textContent = error.message;
  }

  // Every active issue, grouped by location — the sidebar shows all of
  // these for the clicked room.
  const issuesByLocation = {};
  for (const issue of issues) {
    (issuesByLocation[issue.location] ||= []).push(issue);
  }

  // The single highest-severity ACTIVE issue per location — this, and
  // only this, drives the dot's color.
  const worstActiveByLocation = {};
  for (const issue of issues) {
    if (issue.status === "Resolved") continue;
    const existing = worstActiveByLocation[issue.location];
    if (!existing || issue.severity > existing.severity) {
      worstActiveByLocation[issue.location] = issue;
    }
  }

  CAMPUS_LOCATIONS.forEach((location) => {
    const roomIssues = issuesByLocation[location.name] || [];
    const worstIssue = worstActiveByLocation[location.name];

    const openRoom = () => openSidebarForRoom(location, roomIssues);

    // Room polygon: invisible until hovered, click opens the sidebar.
    const poly = L.polygon(ring(location.rect), ROOM_STYLE).addTo(map);
    poly.on("mouseover", () => poly.setStyle(ROOM_HOVER_STYLE));
    poly.on("mouseout", () => poly.setStyle(ROOM_STYLE));
    poly.on("click", openRoom);
    poly.bindTooltip(location.name, { direction: "center", className: "roomlabel-static" });

    // Severity dot at the room's center — reflects only the worst
    // active issue in this room (grey if none).
    const color = worstIssue ? (SEVERITY_COLOR[worstIssue.severity] || NO_REPORT_COLOR) : NO_REPORT_COLOR;
    const baseRadius = worstIssue ? 9 : 6;

    const marker = L.circleMarker(toLatLng(location.x, location.y), {
      radius: baseRadius,
      color: "#111",
      weight: 1.5,
      fillColor: color,
      fillOpacity: 1
    }).addTo(map);

    marker.on("mouseover", () => marker.setStyle({ radius: baseRadius + 3 }));
    marker.on("mouseout", () => marker.setStyle({ radius: baseRadius }));
    marker.on("click", openRoom);
  });
}

configureMapNavigation();
loadMap();
