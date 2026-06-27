window.Pages = window.Pages || {};

/* ---------------- Slider: real salary-range filter ---------------- */
window.Pages["more.slider"] = async function (mount) {
  mount.innerHTML = `<h2 class="page-title">Slider</h2><div class="card"><div class="empty-state">Loading...</div></div>`;
  let range;
  try {
    range = await api.get("/api/employees/salary-range");
  } catch (e) {
    mount.querySelector(".card").innerHTML =
      `<div class="empty-state">${escapeHtml(e.message)}</div>`;
    return;
  }

  const lo = Math.floor(range.min || 0);
  const hi = Math.ceil(range.max || 100000);

  mount.querySelector(".card").outerHTML = `
    <div class="card">
      <p class="muted">Drag the slider to filter employees by salary — this calls <code>/api/employees?min_salary=&max_salary=</code> for real.</p>
      <div class="range-row">
        <span>₹${formatCurrency(lo)}</span>
        <input type="range" id="salary-slider" min="${lo}" max="${hi}" value="${hi}" />
        <span id="slider-val">₹${formatCurrency(hi)}</span>
      </div>
      <div id="slider-results" style="margin-top:16px;"></div>
    </div>`;

  const slider = mount.querySelector("#salary-slider");
  const valLabel = mount.querySelector("#slider-val");
  const resultsDiv = mount.querySelector("#slider-results");

  const runFilter = debounce(async (maxVal) => {
    try {
      const data = await api.get(
        `/api/employees?min_salary=${lo}&max_salary=${maxVal}&page_size=50`,
      );
      resultsDiv.innerHTML = `
        <b>${data.total}</b> employee(s) earn ≤ ₹${formatCurrency(maxVal)}/month:
        <ul style="margin-top:8px;">
          ${
            data.items
              .slice(0, 10)
              .map(
                (e) =>
                  `<li>${escapeHtml(e.full_name)} — ₹${formatCurrency(e.salary)} (${escapeHtml(e.department)})</li>`,
              )
              .join("") || "<li class='muted'>None</li>"
          }
        </ul>`;
    } catch (e) {
      resultsDiv.innerHTML = `<span class="muted">${escapeHtml(e.message)}</span>`;
    }
  }, 300);

  slider.addEventListener("input", (e) => {
    valLabel.textContent = `₹${formatCurrency(e.target.value)}`;
    runFilter(e.target.value);
  });
  runFilter(hi);
};

/* ---------------- Tooltips ---------------- */
window.Pages["more.tooltips"] = function (mount) {
  mount.innerHTML = `
    <h2 class="page-title">Tooltips</h2>
    <div class="card">
      <p>Hover over the highlighted terms below:</p>
      <p>
        <span class="tip">Active<span class="tip-bubble">Employee is currently employed and counted in payroll totals</span></span> vs
        <span class="tip">Inactive<span class="tip-bubble">Employee record kept for history but excluded from active counts</span></span> status determines whether an employee is included in payroll calculations.
      </p>
      <p>
        An <span class="tip">Employee Code<span class="tip-bubble">Server-generated, e.g. EMP-0007 — never editable</span></span> uniquely identifies each record, separate from the
        <span class="tip">Audit Log<span class="tip-bubble">Immutable history of create/update/delete actions, with timestamp and actor</span></span> which tracks every change made to it.
      </p>
    </div>`;
};

/* ---------------- Popups: real Announcement CRUD via modal ---------------- */
window.Pages["more.popups"] = async function (mount) {
  mount.innerHTml = "";
  mount.innerHTML = `
    <h2 class="page-title">Popups</h2>
    <div class="card">
      <div class="toolbar">
        <div class="spacer"></div>
        <button class="btn btn-primary btn-sm" id="new-announcement">+ New Announcement</button>
      </div>
      <div id="announcement-list"><div class="empty-state">Loading...</div></div>
    </div>`;

  const user = Shell.getUser();
  const canManage = user?.role === "admin" || user?.role === "manager";
  if (!canManage)
    mount.querySelector("#new-announcement").style.display = "none";

  async function load() {
    const listEl = mount.querySelector("#announcement-list");
    try {
      const items = await api.get("/api/announcements");
      if (!items.length) {
        listEl.innerHTML = `<div class="empty-state">No announcements yet.</div>`;
        return;
      }
      listEl.innerHTML = items
        .map(
          (a) => `<div class="card" style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;">
              <b>${escapeHtml(a.title)}</b>
              ${canManage ? `<button class="btn btn-danger btn-sm" data-del="${a.id}">Delete</button>` : ""}
            </div>
            <div class="muted" style="margin-top:4px;">${escapeHtml(a.body)}</div>
            <div class="muted" style="font-size:12px;margin-top:6px;">${formatDate(a.created_at)}</div>
          </div>`,
        )
        .join("");
      listEl.querySelectorAll("[data-del]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const ok = await confirmModal({
            title: "Delete announcement?",
            message: "This cannot be undone.",
            confirmLabel: "Delete",
            danger: true,
          });
          if (!ok) return;
          try {
            await api.del(`/api/announcements/${btn.getAttribute("data-del")}`);
            toast("Announcement deleted.", "success");
            load();
          } catch (e) {
            toast(e.message, "error");
          }
        });
      });
    } catch (e) {
      listEl.innerHTML = `<div class="empty-state">${escapeHtml(e.message)}</div>`;
    }
  }

  mount.querySelector("#new-announcement").addEventListener("click", () => {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal-box">
        <h3>New Announcement</h3>
        <div class="field" style="margin-bottom:10px;">
          <label>Title</label>
          <input id="ann-title" type="text" />
        </div>
        <div class="field">
          <label>Body</label>
          <textarea id="ann-body" rows="3"></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="ann-cancel">Cancel</button>
          <button class="btn btn-primary" id="ann-save">Post</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector("#ann-cancel").onclick = () => backdrop.remove();
    backdrop.querySelector("#ann-save").onclick = async () => {
      const title = backdrop.querySelector("#ann-title").value.trim();
      const body = backdrop.querySelector("#ann-body").value.trim();
      if (!title || !body) {
        toast("Title and body are required.", "error");
        return;
      }
      try {
        await api.post("/api/announcements", { title, body });
        toast("Announcement posted.", "success");
        backdrop.remove();
        load();
      } catch (e) {
        toast(e.message, "error");
      }
    };
  });

  load();
};

/* ---------------- Links ---------------- */
window.Pages["more.links"] = function (mount) {
  mount.innerHTML = `
    <h2 class="page-title">Links</h2>
    <div class="card link-list">
      <p class="muted">In-app navigation links (internal routing, no full page reload):</p>
      <a href="#home">→ Home Dashboard</a>
      <a href="#employee.search">→ Search Employees</a>
      <a href="#employee.create">→ Create Employee</a>
      <a href="#settings.audit">→ Activity Log</a>
      <p class="muted" style="margin-top:16px;">External reference link:</p>
      <a href="https://fastapi.tiangolo.com" target="_blank" rel="noopener">→ FastAPI documentation (opens in new tab)</a>
    </div>`;
};

/* ---------------- CSS Properties: live theme/style playground ---------------- */
window.Pages["more.css"] = function (mount) {
  mount.innerHTML = `
    <h2 class="page-title">CSS Properties</h2>
    <div class="card">
      <p class="muted">Live-adjust CSS properties on the box below.</p>
      <div style="display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap;">
        <div id="css-box" class="css-demo-box" style="background:#2f80c4;border-radius:8px;">Preview</div>
        <div class="form-grid single" style="max-width:280px;">
          <div class="field">
            <label>Background Color</label>
            <input id="css-color" type="color" value="#2f80c4" />
          </div>
          <div class="field">
            <label>Border Radius: <span id="radius-val">8px</span></label>
            <input id="css-radius" type="range" min="0" max="50" value="8" />
          </div>
          <div class="field">
            <label>Opacity: <span id="opacity-val">100%</span></label>
            <input id="css-opacity" type="range" min="10" max="100" value="100" />
          </div>
        </div>
      </div>
    </div>`;

  const box = mount.querySelector("#css-box");
  mount
    .querySelector("#css-color")
    .addEventListener("input", (e) => (box.style.background = e.target.value));
  mount.querySelector("#css-radius").addEventListener("input", (e) => {
    box.style.borderRadius = `${e.target.value}px`;
    mount.querySelector("#radius-val").textContent = `${e.target.value}px`;
  });
  mount.querySelector("#css-opacity").addEventListener("input", (e) => {
    box.style.opacity = e.target.value / 100;
    mount.querySelector("#opacity-val").textContent = `${e.target.value}%`;
  });
};

/* ---------------- iFrames ---------------- */
window.Pages["more.iframes"] = function (mount) {
  mount.innerHTML = `
    <h2 class="page-title">iFrames</h2>
    <div class="card">
      <p class="muted">An embedded document rendered inside an &lt;iframe&gt; — useful for automation tools practicing frame-switching.</p>
      <iframe srcdoc="<html><body style='font-family:sans-serif;padding:20px;color:#1b2430;'><h3>Embedded Frame</h3><p>This content lives inside a separate iframe document, not the parent page DOM.</p></body></html>"
              style="width:100%;height:200px;border:1px solid var(--border);border-radius:8px;"></iframe>
    </div>`;
};
