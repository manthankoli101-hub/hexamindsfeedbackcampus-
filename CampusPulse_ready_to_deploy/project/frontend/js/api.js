// When running locally (via `python3 -m http.server` etc.) this points at your
// local backend. Once you deploy the backend (e.g. to Render), replace the
// string below with your live backend URL, e.g.:
//   const DEPLOYED_API_BASE = "https://campusfeedback-backend.onrender.com/api";
const DEPLOYED_API_BASE = "https://hexamindsfeedbackcampus.onrender.com/api"; // <-- paste your deployed backend URL + "/api" here

const API_BASE =
  DEPLOYED_API_BASE ||
  (location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://localhost:5050/api"
    : "");

if (!API_BASE) {
  console.error(
    "API_BASE is not set. Edit js/api.js and set DEPLOYED_API_BASE to your deployed backend URL."
  );
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

const API = {
  login(email) {
    return apiRequest("/login", {
      method: "POST",
      body: JSON.stringify({ email })
    });
  },

  getIssues() {
    return apiRequest("/issues");
  },

  getIssue(id) {
    return apiRequest(`/issues/${encodeURIComponent(id)}`);
  },

  createIssue(payload) {
    return apiRequest("/issues", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  updateIssueStatus(id, status) {
    return apiRequest(`/issues/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
  },

  getIssueReports(id) {
    return apiRequest(`/issues/${encodeURIComponent(id)}/reports`);
  }
};

window.API = API;
