window.Pages = window.Pages || {};

/* ---------------- Multiple Tabs: department breakdown shown as tabs ---------------- */
window.Pages["more.tabs"] = async function (mount) {
  mount.innerHTML = `<h2 class="page-title">Multiple Tabs</h2><div class="card"><div class="empty-state">Loading...</div></div>`;
  let stats;
  try {
    stats = await api.get("/api/dashboard/stats");
  } catch (e) {
    mount.querySelector(".card").innerHTML =
      `<div class="empty-state">${escapeHtml(e.message)}</div>`;
    return;
  }

  const depts = stats.by_department.length
    ? stats.by_department
    : [{ department: "No data", count: 0 }];
  const tabsHtml = depts
    .map(
      (d, i) =>
        `<button class="tab-btn ${i === 0 ? "active" : ""}" data-tab="${i}">${escapeHtml(d.department)}</button>`,
    )
    .join("");
  const panelsHtml = depts
    .map(
      (
        d,
        i,
      ) => `<div class="tab-panel" data-panel="${i}" style="${i === 0 ? "" : "display:none;"}">
        <p>There ${d.count === 1 ? "is" : "are"} currently <b>${d.count}</b> employee(s) in <b>${escapeHtml(d.department)}</b>.</p>
        <p class="muted">This tab strip is driven by live department counts from <code>/api/dashboard/stats</code> rather than placeholder text.</p>
      </div>`,
    )
    .join("");

  mount.innerHTML = `
    <h2 class="page-title">Multiple Tabs</h2>
    <div class="card">
      <div class="tabs-row">${tabsHtml}</div>
      ${panelsHtml}
    </div>`;

  mount.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      mount
        .querySelectorAll("[data-tab]")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const idx = btn.getAttribute("data-tab");
      mount.querySelectorAll("[data-panel]").forEach((p) => {
        p.style.display = p.getAttribute("data-panel") === idx ? "" : "none";
      });
    });
  });
};

/* ---------------- Menu: right-click context menu on employee rows ---------------- */
window.Pages["more.menu"] = async function (mount) {
  mount.innerHTML = `
    <h2 class="page-title">Menu</h2>
    <div class="card">
      <p class="muted">Right-click (or tap-hold) a row below to open a context menu — a classic UI pattern for automation tooling to practice against.</p>
      <table id="menu-table">
        <thead><tr><th>Code</th><th>Name</th><th>Department</th></tr></thead>
        <tbody><tr><td colspan="3" class="muted">Loading...</td></tr></tbody>
      </table>
    </div>`;

  try {
    const data = await api.get("/api/employees?page=1&page_size=6");
    const tbody = mount.querySelector("#menu-table tbody");
    tbody.innerHTML = data.items
      .map(
        (e) => `<tr data-id="${e.id}" data-name="${escapeHtml(e.full_name)}">
          <td>${escapeHtml(e.employee_code)}</td><td>${escapeHtml(e.full_name)}</td><td>${escapeHtml(e.department)}</td>
        </tr>`,
      )
      .join("");

    tbody.querySelectorAll("tr").forEach((row) => {
      row.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        openContextMenu(
          e.pageX,
          e.pageY,
          row.getAttribute("data-id"),
          row.getAttribute("data-name"),
        );
      });
      row.addEventListener("click", (e) => {
        openContextMenu(
          e.pageX,
          e.pageY,
          row.getAttribute("data-id"),
          row.getAttribute("data-name"),
        );
      });
    });
  } catch (e) {
    mount.querySelector("#menu-table tbody").innerHTML =
      `<tr><td colspan="3">${escapeHtml(e.message)}</td></tr>`;
  }

  function openContextMenu(x, y, id, name) {
    document.querySelectorAll(".context-menu").forEach((m) => m.remove());
    const menu = document.createElement("div");
    menu.className = "context-menu";
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.innerHTML = `
      <div class="cm-item" data-act="view">View ${escapeHtml(name)}</div>
      <div class="cm-item" data-act="edit">Edit</div>
      <div class="cm-item" data-act="search">Go to Search</div>`;
    document.body.appendChild(menu);

    menu.querySelector('[data-act="view"]').onclick = () => {
      menu.remove();
      toast(`Viewing ${name} (ID ${id})`, "info");
    };
    menu.querySelector('[data-act="edit"]').onclick = () => {
      menu.remove();
      Shell.navigate("employee.search");
    };
    menu.querySelector('[data-act="search"]').onclick = () => {
      menu.remove();
      Shell.navigate("employee.search");
    };
    setTimeout(() => {
      document.addEventListener("click", () => menu.remove(), { once: true });
    }, 0);
  }
};

/* ---------------- Autocomplete: real prefix-search over employees ---------------- */
window.Pages["more.autocomplete"] = function (mount) {
  mount.innerHTML = `
    <h2 class="page-title">Autocomplete</h2>
    <div class="card">
      <p class="muted">Type an employee's name. Suggestions come live from <code>/api/employees/autocomplete</code>.</p>
      <div class="field" style="max-width:360px;position:relative;">
        <label>Employee Name</label>
        <input id="ac-input" type="text" placeholder="Start typing a name, e.g. 'A'" autocomplete="off" />
        <div id="ac-list" style="position:absolute;top:100%;left:0;right:0;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow);z-index:50;display:none;"></div>
      </div>
      <div id="ac-selected" style="margin-top:14px;"></div>
    </div>`;

  const input = mount.querySelector("#ac-input");
  const list = mount.querySelector("#ac-list");

  const search = debounce(async (q) => {
    if (!q) {
      list.style.display = "none";
      return;
    }
    try {
      const hits = await api.get(
        `/api/employees/autocomplete?q=${encodeURIComponent(q)}`,
      );
      if (!hits.length) {
        list.style.display = "none";
        return;
      }
      list.innerHTML = hits
        .map(
          (h) =>
            `<div class="cm-item" style="padding:9px 12px;cursor:pointer;" data-id="${h.id}" data-name="${escapeHtml(h.full_name)}" data-code="${escapeHtml(h.employee_code)}" data-dept="${escapeHtml(h.department)}">${escapeHtml(h.full_name)} <span class="muted">(${escapeHtml(h.employee_code)})</span></div>`,
        )
        .join("");
      list.style.display = "block";
      list.querySelectorAll("[data-id]").forEach((item) => {
        item.addEventListener("click", () => {
          input.value = item.getAttribute("data-name");
          list.style.display = "none";
          mount.querySelector("#ac-selected").innerHTML = `
            <div class="card" style="margin:0;">
              <b>${escapeHtml(item.getAttribute("data-name"))}</b><br/>
              <span class="muted">${escapeHtml(item.getAttribute("data-code"))} · ${escapeHtml(item.getAttribute("data-dept"))}</span>
            </div>`;
        });
      });
    } catch {
      list.style.display = "none";
    }
  }, 250);

  input.addEventListener("input", (e) => search(e.target.value.trim()));
  document.addEventListener("click", (e) => {
    if (!list.contains(e.target) && e.target !== input)
      list.style.display = "none";
  });
};

/* ---------------- Collapsible Content: FAQ-style accordion ---------------- */
window.Pages["more.collapsible"] = function (mount) {
  const items = [
    {
      q: "How is an employee code generated?",
      a: "Codes are server-assigned sequentially as EMP-0001, EMP-0002, etc. when a record is created — the client never invents one.",
    },
    {
      q: "What happens when I delete an employee?",
      a: "By default the record is soft-deleted (status set to Inactive) so history is preserved. Admins/Managers can choose a permanent delete instead.",
    },
    {
      q: "Who can manage user accounts?",
      a: "Only Admin role users can create accounts, change roles, or deactivate logins, via Settings > Manage Users.",
    },
    {
      q: "Where can I see who changed what?",
      a: "Settings > Activity Log shows a full audit trail of create/update/delete/login actions, timestamped per user.",
    },
  ];

  mount.innerHTML = `
    <h2 class="page-title">Collapsible Content</h2>
    <div class="card">
      ${items
        .map(
          (it, i) => `
        <div class="accordion-item">
          <div class="accordion-head" data-acc="${i}">${escapeHtml(it.q)} <span>+</span></div>
          <div class="accordion-body" id="acc-body-${i}">${escapeHtml(it.a)}</div>
        </div>`,
        )
        .join("")}
    </div>`;

  mount.querySelectorAll("[data-acc]").forEach((head) => {
    head.addEventListener("click", () => {
      const idx = head.getAttribute("data-acc");
      const body = mount.querySelector(`#acc-body-${idx}`);
      body.classList.toggle("open");
    });
  });
};

/* ---------------- Images: simple gallery ---------------- */
window.Pages["more.images"] = function (mount) {
  const depts = window.EmployeeForm.DEPARTMENTS;
  const colors = [
    "#2f80c4",
    "#2e9e5b",
    "#c98a1d",
    "#cc4b4b",
    "#7e57c2",
    "#00897b",
  ];
  mount.innerHTML = `
    <h2 class="page-title">Images</h2>
    <div class="card">
      <p class="muted">A department tile gallery (colour standing in for department photos in this lightweight UI).</p>
      <div class="gallery">
        ${depts.map((d, i) => `<div class="tile" style="background:${colors[i % colors.length]}">${escapeHtml(d)}</div>`).join("")}
      </div>
    </div>`;
};
