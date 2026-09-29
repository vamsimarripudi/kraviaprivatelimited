const $ = (selector) => document.querySelector(selector);

function show(id) {
  ["signInForm", "mfaPanel", "deniedPanel", "readyPanel"].forEach((item) => { $("#" + item).hidden = item !== id; });
}

function status(message, type = "") {
  const element = $("#status");
  element.textContent = message;
  element.className = "status" + (type ? " " + type : "");
}

async function authApi(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const response = await fetch("/api/v1/auth/" + path, { ...options, headers, credentials: "same-origin" });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) throw new Error(body?.detail || body || `HTTP ${response.status}`);
  return body;
}

async function routeSession(session) {
  if (!session?.authenticated) {
    status("Sign in to continue.");
    show("signInForm");
    return;
  }
  if (session.aal === "aal2") {
    if (!Array.isArray(session.roles) || session.roles.length === 0) {
      status("Identity verified; Office role assignment is still required.", "error");
      show("deniedPanel");
      return;
    }
    status("Identity and MFA verified.", "good");
    $("#identitySummary").textContent = `${session.email || "Authorized user"} · ${session.roles.join(", ")} · AAL2`;
    show("readyPanel");
    return;
  }
  await prepareMfa();
}

async function prepareMfa() {
  status("Password accepted. Authenticator MFA is required.");
  show("mfaPanel");
  $("#enrollBox").hidden = false;
  $("#mfaText").textContent = "If this is a new phone, activate it in Authenticator and wait for an Office owner or administrator to approve it. Then enter its current six-digit code.";
  $("#mfaCode").focus();
}

async function verifyMfa(code) {
  status("Verifying authenticator code…");
  const session = await authApi("mfa/verify", { method: "POST", body: JSON.stringify({ code }) });
  await routeSession(session);
}

async function signOut() {
  try { await authApi("sign-out", { method: "POST" }); } catch (_) { /* best effort */ }
  $("#signInForm").reset();
  $("#mfaForm").reset();
  status("Signed out.");
  show("signInForm");
}

$("#signInForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  status("Signing in…");
  const email = $("#email").value.trim();
  const password = $("#password").value;
  try {
    const session = await authApi("sign-in", { method: "POST", body: JSON.stringify({ email, password }) });
    $("#password").value = "";
    await routeSession(session);
  } catch (error) {
    status(error.message, "error");
    show("signInForm");
  }
});

$("#mfaForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = $("#mfaCode").value.trim();
  try { await verifyMfa(code); } catch (error) { status(error.message, "error"); $("#mfaCode").select(); }
});

$("#continueBtn").addEventListener("click", () => location.replace("/"));
$("#signOutReady").addEventListener("click", signOut);
$("#signOutDenied").addEventListener("click", signOut);

(async () => {
  try { await routeSession(await authApi("session")); }
  catch (_) { status("Sign in to continue."); show("signInForm"); }
})();
