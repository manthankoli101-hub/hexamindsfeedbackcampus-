const currentUser = JSON.parse(localStorage.getItem("campus_user") || "null");

if (!currentUser) {
  window.location.href = "index.html";
}

const isAdminPage = ["admin.html"].some((page) =>
  window.location.pathname.endsWith(`/${page}`)
);

if (isAdminPage && currentUser?.role !== "admin") {
  window.location.href = "student-dashboard.html";
}

document.querySelectorAll("[data-logout]").forEach((button) => {
  button.addEventListener("click", () => {
    localStorage.removeItem("campus_user");
    window.location.href = "index.html";
  });
});
