const studentUser = JSON.parse(localStorage.getItem("campus_user") || "null");

document.getElementById("studentGreeting").textContent =
  `Welcome, ${studentUser?.name || "Student"}`;

async function loadStudentIssues() {
  const list = document.getElementById("issueList");
  try {
    const issues = await API.getIssues();

    const mine = issues.filter((issue) =>
      issue.createdBy === studentUser?.id || issue.createdBy === "u1"
    );

    document.getElementById("openCount").textContent =
      mine.filter((x) => x.status !== "Resolved").length;

    document.getElementById("highCount").textContent =
      mine.filter((x) => x.priority >= 3).length;

    document.getElementById("resolvedCount").textContent =
      mine.filter((x) => x.status === "Resolved").length;

    if (!mine.length) {
      list.innerHTML = `<div class="empty-state">No complaints submitted yet.</div>`;
      return;
    }

    list.innerHTML = mine.map((issue) => `
      <a class="issue-row" href="issue?id=${encodeURIComponent(issue.id)}">
        <div>
          <strong>${escapeHtml(issue.title)}</strong>
          <small>${escapeHtml(issue.location)} · ${escapeHtml(issue.department)}</small>
        </div>
        <div class="row-right">
          <span class="badge p${issue.priority}">P${issue.priority}</span>
          <span>${escapeHtml(issue.status)}</span>
        </div>
      </a>
    `).join("");
  } catch (error) {
    list.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadStudentIssues();
