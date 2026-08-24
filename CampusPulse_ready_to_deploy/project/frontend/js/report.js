const user = JSON.parse(localStorage.getItem("campus_user") || "null");
const form = document.getElementById("reportForm");
const description = document.getElementById("description");
const locationInput = document.getElementById("location");
const submitBtn = document.getElementById("submitBtn");
const errorBox = document.getElementById("reportError");

let severity = 2;

// Build the Location dropdown from the shared floorplan location list
// (js/locations.js) so it always matches the dots on the Severity Map.
locationInput.innerHTML = CAMPUS_LOCATIONS.map((loc) =>
  `<option value="${loc.name}">${loc.name}</option>`
).join("");

document.querySelectorAll(".severity-option").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".severity-option").forEach((b) => b.classList.remove("selected"));
    button.classList.add("selected");
    severity = Number(button.dataset.value);
  });
});

const modal = document.getElementById("resultModal");
const closeModal = document.getElementById("closeModal");
const resultContent = document.getElementById("resultContent");

function closeResultModal() {
  modal.classList.add("hidden");
}

closeModal.addEventListener("click", closeResultModal);
document.getElementById("modalDone").addEventListener("click", closeResultModal);
// Intentionally do not close when the backdrop is clicked.
// The result stays visible until the user explicitly closes it or opens the issue.

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.textContent = "";
  submitBtn.disabled = true;
  submitBtn.textContent = "Analyzing...";

  try {
    const result = await API.createIssue({
      description: description.value.trim(),
      location: locationInput.value,
      severity,
      createdBy: user?.id || "u1"
    });

    if (result.mode === "duplicate") {
      resultContent.innerHTML = `
        <h2>Related issue detected</h2>
        <p class="muted">Your report matches an existing unresolved issue, so CampusFeedback added it as another report instead of creating a separate ticket.</p>
        <div class="analysis-grid">
          <div><span>Issue ID</span><strong>${escapeHtml(result.issue.id)}</strong></div>
          <div><span>Reports</span><strong>${result.issue.duplicateCount}</strong></div>
          <div><span>Priority</span><strong>P${result.issue.priority}</strong></div>
          <div><span>Department</span><strong>${escapeHtml(result.issue.department)}</strong></div>
          <div><span>Current status</span><strong>${escapeHtml(result.issue.status)}</strong></div>
          <div><span>Match</span><strong>${result.similarity}%</strong></div>
        </div>
        <div class="result-highlight">
          <strong>${escapeHtml(result.issue.title)}</strong>
          <span>AI processed · Duplicate checked · Department assigned</span>
        </div>
        <a class="btn btn-primary" href="issue?id=${encodeURIComponent(result.issue.id)}">View Issue</a>
        <a class="btn btn-ghost" href="map.html">View on Severity Map</a>
      `;
    } else {
      resultContent.innerHTML = `
        <h2>Report submitted successfully</h2>
        <p class="muted">Your complaint has been analyzed, checked for duplicates and routed to the responsible department.</p>
        <div class="analysis-grid">
          <div><span>Issue ID</span><strong>${escapeHtml(result.issue.id)}</strong></div>
          <div><span>Category</span><strong>${escapeHtml(result.analysis.category)}</strong></div>
          <div><span>Priority</span><strong>P${result.issue.priority}</strong></div>
          <div><span>Department</span><strong>${escapeHtml(result.analysis.department)}</strong></div>
          <div><span>Duplicate check</span><strong>No duplicate</strong></div>
          <div><span>Current status</span><strong>Assigned</strong></div>
        </div>
        <div class="result-highlight success-highlight">
          <strong>✓ Assigned to ${escapeHtml(result.analysis.department)}</strong>
          <span>AI Processed → Duplicate Checked → Assigned</span>
        </div>
        ${result.analysis.hazardDetected ? `<p class="form-error">Potential hazard detected. Admin review is recommended.</p>` : ""}
        <a class="btn btn-primary" href="issue?id=${encodeURIComponent(result.issue.id)}">View Issue</a>
        <a class="btn btn-ghost" href="map.html">View on Severity Map</a>
      `;
    }

    modal.classList.remove("hidden");
  } catch (error) {
    errorBox.textContent = error.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Analyze & Submit";
  }
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
