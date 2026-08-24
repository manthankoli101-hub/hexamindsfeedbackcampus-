async function loadAdmin() {
  const list = document.getElementById("adminIssueList");

  try {
    const issues = await API.getIssues();

    document.getElementById("totalIssues").textContent = issues.length;
    document.getElementById("openIssues").textContent =
      issues.filter((x) => x.status !== "Resolved").length;
    document.getElementById("highIssues").textContent =
      issues.filter((x) => x.priority >= 3).length;
    document.getElementById("hazardIssues").textContent =
      issues.filter((x) => x.priority === 4).length;

    list.innerHTML = issues.length ? issues.map((issue) => `
      <a class="issue-row" href="issue?id=${encodeURIComponent(issue.id)}">
        <div>
          <strong>${escapeHtml(issue.title)}</strong>
          <small>${escapeHtml(issue.location)} · ${issue.duplicateCount} reports · ${escapeHtml(issue.department)}</small>
        </div>
        <div class="row-right">
          <span class="badge p${issue.priority}">P${issue.priority}</span>
          <span>${escapeHtml(issue.status)}</span>
        </div>
      </a>
    `).join("") : `<div class="empty-state">No issues yet.</div>`;

    const deptCounts = {};
    issues.forEach((issue) => {
      if (issue.status !== "Resolved") {
        deptCounts[issue.department] = (deptCounts[issue.department] || 0) + 1;
      }
    });

    const entries = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]);
    const max = entries.length ? Math.max(...entries.map((x) => x[1])) : 1;

    document.getElementById("departmentBars").innerHTML = entries.length
      ? entries.map(([name, count]) => `
        <div>
          <div class="bar-label"><span>${escapeHtml(name)}</span><strong>${count}</strong></div>
          <div class="bar"><span style="width:${Math.max(10, count / max * 100)}%"></span></div>
        </div>
      `).join("")
      : `<div class="empty-state">No open workload.</div>`;
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

loadAdmin();
