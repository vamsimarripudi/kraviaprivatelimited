(function () {
  "use strict";

  const form = document.getElementById("login-form");
  const submit = document.getElementById("login-submit");
  const message = document.getElementById("login-message");
  const email = document.getElementById("email");
  const password = document.getElementById("password");

  checkSession();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors();

    const payload = {
      email: email.value.trim(),
      password: password.value,
    };

    const errors = {};
    if (!payload.email) {
      errors.email = "Email is required.";
    }
    if (!payload.password) {
      errors.password = "Password is required.";
    }

    if (Object.keys(errors).length > 0) {
      showErrors(errors);
      return;
    }

    submit.disabled = true;
    submit.textContent = "Signing in";
    message.textContent = "";
    message.className = "form-message";

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || "Sign in failed.");
      }

      window.location.assign("/workspace");
    } catch (error) {
      message.textContent = error.message;
      message.classList.add("is-error");
    } finally {
      submit.disabled = false;
      submit.textContent = "Sign in";
    }
  });

  async function checkSession() {
    const response = await fetch("/api/session", { credentials: "same-origin" }).catch(() => null);
    if (response && response.ok) {
      window.location.replace("/workspace");
    }
  }

  function clearErrors() {
    document.getElementById("email-error").textContent = "";
    document.getElementById("password-error").textContent = "";
  }

  function showErrors(errors) {
    if (errors.email) {
      document.getElementById("email-error").textContent = errors.email;
    }
    if (errors.password) {
      document.getElementById("password-error").textContent = errors.password;
    }
  }
})();
