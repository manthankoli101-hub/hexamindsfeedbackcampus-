const params = new URLSearchParams(window.location.search);
const issueId = params.get("id");
const issueUser = JSON.parse(localStorage.getItem("campus_user") || "null");

async function loadIssue() {
  if (!issueId) {
    configureNavigation();
    await renderIssuePicker();
    return;
  }

  try {
    const issue = await API.getIssue(issueId);
    configureNavigation();
    renderIssue(issue);
    loadIssueReports(issue);
  } catch (error) {
    document.getElementById("issueHeader").innerHTML = `
      <div>
        <p class="eyebrow">ISSUE DETAILS</p>
        <h2>Unable to load issue</h2>
        <p class="muted">${escapeHtml(error.message)}</p>
      </div>`;
    document.getElementById("issueDetails").innerHTML = `
      <div class="empty-state">
        <strong>We couldn't retrieve ${escapeHtml(issueId)}.</strong>
        <p>Make sure the CampusFeedback backend is running on port 5050, then refresh this page.</p>
      </div>`;
    document.getElementById("timeline").innerHTML = "";
  }
}

function configureNavigation() {
  const dashboard = document.getElementById("issueNavDashboard");
  const secondary = document.getElementById("issueNavSecondary");
  const mapLink = document.getElementById("issueNavMap");

  if (issueUser?.role === "admin") {
    dashboard.href = "admin.html";
    dashboard.textContent = "Dashboard";
    mapLink.href = "map.html";
    mapLink.textContent = "Severity Map";
    secondary.href = "admin.html";
    secondary.textContent = "Admin";
  } else {
    dashboard.href = "student-dashboard.html";
    dashboard.textContent = "Dashboard";
    mapLink.href = "map.html";
    mapLink.textContent = "Severity Map";
    secondary.href = "report.html";
    secondary.textContent = "Report Issue";
  }
}

// No ?id= was given in the URL — instead of a dead end, show every current
// issue so the person can pick the one they want to open.
async function renderIssuePicker() {
  document.getElementById("issueHeader").innerHTML = `
    <div>
      <p class="eyebrow">ISSUE DETAILS</p>
      <h2>All current issues</h2>
      <p class="muted">No specific issue was selected — pick one below to see its details.</p>
    </div>`;
  document.getElementById("timeline").innerHTML = "";
  document.getElementById("adminControls").classList.add("hidden");

  const box = document.getElementById("issueDetails");
  box.innerHTML = `<div class="empty-state">Loading issues...</div>`;

  try {
    const issues = await API.getIssues();
    box.innerHTML = issues.length
      ? `<div class="issue-list">${issues.map((issue) => `
          <a class="issue-row" href="issue?id=${encodeURIComponent(issue.id)}">
            <div>
              <strong>${escapeHtml(issue.id)} — ${escapeHtml(issue.title)}</strong>
              <small>${escapeHtml(issue.location)} · ${escapeHtml(issue.department)} · Severity ${issue.severity}/4</small>
            </div>
            <div class="row-right">
              <span class="badge p${issue.priority}">P${issue.priority}</span>
              <span>${escapeHtml(issue.status)}</span>
            </div>
          </a>
        `).join("")}</div>`
      : `<div class="empty-state">No issues have been reported yet.</div>`;
  } catch (error) {
    box.innerHTML = `<div class="empty-state">${escapeHtml(error.message)} Make sure the CampusFeedback backend is running on port 5050, then refresh this page.</div>`;
  }
}

function renderIssue(issue) {
  document.getElementById("issueHeader").innerHTML = `
    <div>
      <p class="eyebrow">${escapeHtml(issue.id)}</p>
      <h2>${escapeHtml(issue.title)}</h2>
      <p class="muted">${escapeHtml(issue.location)} · ${escapeHtml(issue.department)}</p>
    </div>
    <span class="priority-large p${issue.priority}">P${issue.priority}</span>
  `;

  document.getElementById("issueDetails").innerHTML = `
    <p class="eyebrow">ISSUE DETAILS</p>
    <h3>What was reported</h3>
    <p>${escapeHtml(issue.description)}</p>

    <div class="meta-grid">
      <div><span>Severity</span><strong>${issue.severity}/4${issue.baseSeverity && issue.baseSeverity !== issue.severity ? ` <small class="muted">(reported as ${issue.baseSeverity})</small>` : ""}</strong></div>
      <div><span>Priority</span><strong>${issue.priority}/4</strong></div>
      <div><span>Category</span><strong>${escapeHtml(issue.category)}</strong></div>
      <div><span>Department</span><strong>${escapeHtml(issue.department)}</strong></div>
      <div><span>Duplicate reports</span><strong>${issue.duplicateCount}</strong></div>
      <div><span>Current status</span><strong>${escapeHtml(issue.status)}</strong></div>
    </div>
    ${issue.baseSeverity && issue.baseSeverity !== issue.severity ? `<p class="muted small">Severity has escalated from ${issue.baseSeverity} to ${issue.severity} because ${issue.duplicateCount} people reported this issue.</p>` : ""}
  `;

  const steps = [
    "Submitted",
    "AI Processed",
    "Duplicate Checked",
    "Assigned",
    "In Progress",
    "Resolved",
    "Student Verification"
  ];

  const currentIndex = getStepIndex(issue.status);

  document.getElementById("timeline").innerHTML = steps.map((step, index) => `
    <div class="timeline-item ${index === currentIndex ? "current" : ""} ${index < currentIndex ? "completed" : ""}">
      <span class="timeline-dot ${index <= currentIndex ? "" : "muted"}"></span>
      <span>${step}${index === currentIndex ? " — Current" : index < currentIndex ? " — Complete" : ""}</span>
    </div>
  `).join("");

  renderAdminControls(issue);
}

// Every individual report grouped under this issue, shown as a Reddit-style
// comment thread so anyone opening the issue can see each student's own
// comment rather than just the total duplicateCount. Visible to every user
// (not just admins) — it's the "community" view of who else reported this.
// Lives in its own container (not inside #issueDetails) so a status update
// re-render doesn't wipe it out.
async function loadIssueReports(issue) {
  const box = document.getElementById("issueReports");

  box.classList.remove("hidden");
  box.innerHTML = `
    <p class="eyebrow">DISCUSSION</p>
    <h3>Comments on ${escapeHtml(issue.id)}</h3>
    <div class="empty-state">Loading comments...</div>
  `;

  try {
    const reports = await API.getIssueReports(issue.id);
    const onRecordCount = reports.length;
    const untracked = Math.max(0, issue.duplicateCount - onRecordCount);

    box.innerHTML = `
      <p class="eyebrow">DISCUSSION</p>
      <h3>💬 ${onRecordCount} comment${onRecordCount === 1 ? "" : "s"} on ${escapeHtml(issue.id)}</h3>
      <p class="muted">Every student report folded into this issue, grouped together in one thread.</p>
      ${onRecordCount ? `<div class="reddit-thread">${reports.map((r, i) => `
        <div class="reddit-comment">
          <div class="reddit-comment-rail">
            <span class="reddit-avatar">${escapeHtml(initials(r.studentName))}</span>
          </div>
          <div class="reddit-comment-content">
            <div class="reddit-comment-meta">
              <span class="reddit-comment-author">${escapeHtml(r.studentName)}</span>
              ${i === 0 ? `<span class="reddit-op-badge">OP</span>` : ""}
              <span class="reddit-comment-dot">&middot;</span>
              <span class="reddit-comment-time" title="${new Date(r.createdAt).toLocaleString()}">${timeAgo(r.createdAt)}</span>
            </div>
            <p class="reddit-comment-text">${escapeHtml(r.description)}</p>
          </div>
        </div>
      `).join("")}</div>` : `<div class="empty-state">No individual comments on file for this issue.</div>`}
      ${untracked > 0 ? `<p class="muted small report-untracked-note">${untracked} additional duplicate report${untracked === 1 ? "" : "s"} were folded into the count before per-comment text was tracked, so those don't have a comment shown here.</p>` : ""}
    `;
  } catch (error) {
    box.innerHTML = `
      <p class="eyebrow">DISCUSSION</p>
      <h3>Comments on ${escapeHtml(issue.id)}</h3>
      <div class="empty-state">${escapeHtml(error.message)}</div>
    `;
  }
}

// Up to two initials from a display name, for the little avatar circle
// ("Demo Student" -> "DS", "Priya" -> "P").
function initials(name) {
  const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

// Reddit-style relative timestamp ("just now", "5m ago", "3h ago", "2d ago"),
// falling back to a short date once it's more than a week old.
function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function renderAdminControls(issue) {
  const box = document.getElementById("adminControls");

  if (issueUser?.role !== "admin") {
    box.classList.add("hidden");
    return;
  }

  box.classList.remove("hidden");
  box.innerHTML = `
    <p class="eyebrow">ADMIN ACTION</p>
    <h3>Update issue status</h3>
    <p class="muted">AI processing, duplicate checking and department assignment happen automatically. Admin moves the issue through operational stages.</p>
    <div class="status-actions">
      <select id="statusSelect" aria-label="Issue status">
        <option value="Assigned" ${issue.status === "Assigned" ? "selected" : ""}>Assigned</option>
        <option value="In Progress" ${issue.status === "In Progress" ? "selected" : ""}>In Progress</option>
        <option value="Resolved" ${issue.status === "Resolved" ? "selected" : ""}>Resolved</option>
      </select>
      <button id="statusUpdateBtn" class="btn btn-primary">Update Status</button>
    </div>
    <p id="statusMessage" class="status-message"></p>
  `;

  document.getElementById("statusUpdateBtn").addEventListener("click", async () => {
    const select = document.getElementById("statusSelect");
    const button = document.getElementById("statusUpdateBtn");
    const message = document.getElementById("statusMessage");

    button.disabled = true;
    button.textContent = "Updating...";
    message.textContent = "";

    try {
      const updated = await API.updateIssueStatus(issue.id, select.value);
      renderIssue(updated);
      loadIssueReports(updated);
      document.getElementById("statusMessage").textContent = `Status updated to ${updated.status}.`;
    } catch (error) {
      message.textContent = error.message;
      button.disabled = false;
      button.textContent = "Update Status";
    }
  });
}

function getStepIndex(status) {
  const map = {
    "Submitted": 0,
    "Assigned": 3,
    "In Progress": 4,
    "Resolved": 5,
    "Student Verification": 6
  };
  return map[status] ?? 3;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadIssue();
