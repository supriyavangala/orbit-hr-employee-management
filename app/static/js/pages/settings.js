window.Pages = window.Pages || {};

/* ---------------- Change Password ---------------- */
window.Pages["settings.password"] = function (mount) {
  mount.innerHTML = `
    <h2 class="page-title">Change Password</h2>
    <div class="card" style="max-width:420px;">
      <div class="field" style="margin-bottom:12px;">
        <label>Current Password</label>
        <input id="cp-current" type="password" />
      </div>
      <div class="field" style="margin-bottom:6px;">
        <label>New Password</label>
        <input id="cp-new" type="password" />
        <div class="error-text" id="cp-error"></div>
      </div>
      <div class="field" style="margin-bottom:16px;">
        <label>Confirm New Password</label>
        <input id="cp-confirm" type="password" />
      </div>
      <button class="btn btn-primary" id="cp-submit">Update Password</button>
    </div>`;

  document.getElementById("cp-submit").addEventListener("click", async () => {
    const current = document.getElementById("cp-current").value;
    const next = document.getElementById("cp-new").value;
    const confirm = document.getElementById("cp-confirm").value;
    const errEl = document.getElementById("cp-error");
    errEl.textContent = "";

    if (!current || !next || !confirm) {
      errEl.textContent = "All fields are required.";
      return;
    }
    if (next.length < 6) {
      errEl.textContent = "New password must be at least 6 characters.";
      return;
    }
    if (next !== confirm) {
      errEl.textContent = "New password and confirmation do not match.";
      return;
    }

    try {
      await api.post("/api/auth/change-password", {
        current_password: current,
        new_password: next,
      });
      toast("Password updated successfully.", "success");
      document.getElementById("cp-current").value = "";
      document.getElementById("cp-new").value = "";
      document.getElementById("cp-confirm").value = "";
    } catch (e) {
      errEl.textContent = e.message;
    }
  });
};

/* ---------------- Manage Users (Admin only) ---------------- */
window.Pages["settings.users"] = async function (mount) {
  const user = Shell.getUser();
  if (user?.role !== "admin") {
    mount.innerHTML = `<h2 class="page-title">Manage Users</h2><div class="card"><div class="empty-state">Only Admin users can manage accounts.</div></div>`;
    return;
  }

  mount.innerHTML = `
    <h2 class="page-title">Manage Users</h2>
    <div class="card">
      <div class="toolbar">
        <div class="spacer"></div>
        <button class="btn btn-primary btn-sm" id="new-user-btn">+ New User</button>
      </div>
      <div id="users-table"><div class="empty-state">Loading...</div></div>
    </div>`;

  async function load() {
    const area = document.getElementById("users-table");
    try {
      const users = await api.get("/api/users");
      area.innerHTML = `
        <table>
          <thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${users
              .map(
                (u) => `<tr>
                <td>${escapeHtml(u.username)}</td>
                <td>${escapeHtml(u.email)}</td>
                <td><span class="badge ${u.role}">${u.role}</span></td>
                <td><span class="badge ${u.is_active ? "active" : "inactive"}">${u.is_active ? "Active" : "Disabled"}</span></td>
                <td>
                  <select data-role="${u.id}" ${u.id === user.id ? "disabled" : ""} style="padding:4px 6px;font-size:12.5px;">
                    ${["admin", "manager", "staff"].map((r) => `<option value="${r}" ${r === u.role ? "selected" : ""}>${r}</option>`).join("")}
                  </select>
                  <button class="btn btn-secondary btn-sm" data-toggle="${u.id}" ${u.id === user.id ? "disabled" : ""}>${u.is_active ? "Disable" : "Enable"}</button>
                  <button class="btn btn-danger btn-sm" data-del="${u.id}" data-name="${escapeHtml(u.username)}" ${u.id === user.id ? "disabled" : ""}>Delete</button>
                </td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>`;

      area.querySelectorAll("[data-role]").forEach((sel) => {
        sel.addEventListener("change", async () => {
          try {
            await api.put(
              `/api/users/${sel.getAttribute("data-role")}/role?role=${sel.value}`,
              {},
            );
            toast("Role updated.", "success");
            load();
          } catch (e) {
            toast(e.message, "error");
          }
        });
      });
      area.querySelectorAll("[data-toggle]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          try {
            await api.put(
              `/api/users/${btn.getAttribute("data-toggle")}/toggle-active`,
              {},
            );
            load();
          } catch (e) {
            toast(e.message, "error");
          }
        });
      });
      area.querySelectorAll("[data-del]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const ok = await confirmModal({
            title: "Delete user?",
            message: `${btn.getAttribute("data-name")}'s account will be permanently removed.`,
            confirmLabel: "Delete",
            danger: true,
          });
          if (!ok) return;
          try {
            await api.del(`/api/users/${btn.getAttribute("data-del")}`);
            toast("User deleted.", "success");
            load();
          } catch (e) {
            toast(e.message, "error");
          }
        });
      });
    } catch (e) {
      area.innerHTML = `<div class="empty-state">${escapeHtml(e.message)}</div>`;
    }
  }

  document.getElementById("new-user-btn").addEventListener("click", () => {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal-box">
        <h3>New User</h3>
        <div class="field" style="margin-bottom:10px;"><label>Username</label><input id="nu-username" /></div>
        <div class="field" style="margin-bottom:10px;"><label>Email</label><input id="nu-email" type="email" /></div>
        <div class="field" style="margin-bottom:10px;"><label>Password</label><input id="nu-password" type="password" /></div>
        <div class="field">
          <label>Role</label>
          <select id="nu-role">
            <option value="staff">staff</option>
            <option value="manager">manager</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <div class="error-text" id="nu-error"></div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="nu-cancel">Cancel</button>
          <button class="btn btn-primary" id="nu-save">Create</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector("#nu-cancel").onclick = () => backdrop.remove();
    backdrop.querySelector("#nu-save").onclick = async () => {
      const username = backdrop.querySelector("#nu-username").value.trim();
      const email = backdrop.querySelector("#nu-email").value.trim();
      const password = backdrop.querySelector("#nu-password").value;
      const role = backdrop.querySelector("#nu-role").value;
      const errEl = backdrop.querySelector("#nu-error");
      if (!username || !email || password.length < 6) {
        errEl.textContent =
          "Username, email, and a password (6+ chars) are required.";
        return;
      }
      try {
        await api.post("/api/users", { username, email, password, role });
        toast("User created.", "success");
        backdrop.remove();
        load();
      } catch (e) {
        errEl.textContent = e.message;
      }
    };
  });

  load();
};

/* ---------------- Activity Log ---------------- */
window.Pages["settings.audit"] = async function (mount) {
  const user = Shell.getUser();
  if (user?.role === "staff") {
    mount.innerHTML = `<h2 class="page-title">Activity Log</h2><div class="card"><div class="empty-state">Activity log is visible to Admin and Manager roles only.</div></div>`;
    return;
  }

  mount.innerHTML = `<h2 class="page-title">Activity Log</h2><div class="card"><div class="empty-state">Loading...</div></div>`;
  try {
    const logs = await api.get("/api/audit-logs?limit=100");
    const rows = logs
      .map(
        (l) => `<tr>
          <td>${formatDate(l.timestamp)} ${new Date(l.timestamp).toLocaleTimeString()}</td>
          <td>${escapeHtml(l.actor_username || "system")}</td>
          <td><span class="badge ${l.action === "DELETE" ? "inactive" : l.action === "CREATE" ? "active" : "manager"}">${l.action}</span></td>
          <td>${escapeHtml(l.entity_type)}${l.entity_id ? " #" + l.entity_id : ""}</td>
          <td class="muted">${escapeHtml(l.details || "")}</td>
        </tr>`,
      )
      .join("");

    mount.querySelector(".card").innerHTML = `
      <table>
        <thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="5" class="muted">No activity recorded yet.</td></tr>`}</tbody>
      </table>`;
  } catch (e) {
    mount.querySelector(".card").innerHTML =
      `<div class="empty-state">${escapeHtml(e.message)}</div>`;
  }
};

/* ---------------- Appearance / Theme ---------------- */
window.Pages["settings.theme"] = function (mount) {
  const user = Shell.getUser();
  mount.innerHTML = `
    <h2 class="page-title">Appearance</h2>
    <div class="card" style="max-width:420px;">
      <p class="muted">Choose how Orbit HR looks for your account. Saved to your profile.</p>
      <div style="display:flex;gap:14px;">
        <button class="btn ${user?.theme !== "dark" ? "btn-primary" : "btn-secondary"}" id="theme-light">☀ Light</button>
        <button class="btn ${user?.theme === "dark" ? "btn-primary" : "btn-secondary"}" id="theme-dark">🌙 Dark</button>
      </div>
    </div>`;

  async function setTheme(theme) {
    try {
      const updated = await api.put("/api/auth/theme", { theme });
      Shell.setUser(updated);
      Shell.applyTheme();
      Shell.render();
      toast(`Theme set to ${theme}.`, "success");
    } catch (e) {
      toast(e.message, "error");
    }
  }

  document
    .getElementById("theme-light")
    .addEventListener("click", () => setTheme("light"));
  document
    .getElementById("theme-dark")
    .addEventListener("click", () => setTheme("dark"));
};
