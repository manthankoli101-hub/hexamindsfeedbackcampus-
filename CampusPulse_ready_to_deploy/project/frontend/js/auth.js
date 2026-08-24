const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";

  const email = document.getElementById("email").value.trim();

  try {
    const result = await API.login(email);
    localStorage.setItem("campus_user", JSON.stringify(result.user));

    if (result.user.role === "admin") {
      window.location.href = "admin.html";
    } else {
      window.location.href = "student-dashboard.html";
    }
  } catch (error) {
    loginError.textContent = error.message;
  }
});
