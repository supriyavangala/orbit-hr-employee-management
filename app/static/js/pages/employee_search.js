window.Pages = window.Pages || {};

window.Pages["employee.search"] = function (mount) {
  const state = {
    q: "",
    department: "",
    status: "",
    page: 1,
    pageSize: 10,
    sortBy: "full_name",
    sortDir: "asc",
  };

  mount.innerHTML = `
    <h2 class="page-title">Search Employees</h2>
    <div class="card">
      <div class="toolbar">
        <input id="search-q" type="text" placeholder="Search by name, code, or email..." style="min-width:240px;" />
        <select id="search-dept">
          <option value="">All Departments</option>
          ${window.EmployeeForm.DEPARTMENTS.map((d) => `<option value="${d}">${d}</option>`).join("")}
        </select>
        <select id="search-status">
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
        <div class="spacer"></div>
        <button class="btn btn-secondary btn-sm" id="export-btn">⬇ Export CSV</button>
        <button class="btn btn-primary btn-sm" id="new-btn">+ New Employee</button>
      </div>
      <div id="results-area"><div class="empty-state">Loading...</div></div>
    </div>
  `;

  document
    .getElementById("new-btn")
    .addEventListener("click", () => Shell.navigate("employee.create"));
  document.getElementById("export-btn").addEventListener("click", () => {
    const params = new URLSearchParams();
    if (state.department) params.set("department", state.department);
    if (state.status) params.set("status", state.status);
    const token = localStorage.getItem("ems_token");
    // Use a temporary fetch + blob download since the endpoint requires the auth header.
    fetch(`/api/employees/export.csv?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "employees.csv";
        a.click();
        URL.revokeObjectURL(url);
        toast("CSV export started.", "success");
      })
      .catch(() => toast("Export failed.", "error"));
  });

  const debouncedSearch = debounce(() => {
    state.q = document.getElementById("search-q").value.trim();
    state.page = 1;
    loadResults();
  }, 350);
  document
    .getElementById("search-q")
    .addEventListener("input", debouncedSearch);

  document.getElementById("search-dept").addEventListener("change", (e) => {
    state.department = e.target.value;
    state.page = 1;
    loadResults();
  });
  document.getElementById("search-status").addEventListener("change", (e) => {
    state.status = e.target.value;
    state.page = 1;
    loadResults();
  });

  async function loadResults() {
    const area = document.getElementById("results-area");
    area.innerHTML = `<div class="empty-state">Loading...</div>`;
    try {
      const params = new URLSearchParams({
        page: state.page,
        page_size: state.pageSize,
        sort_by: state.sortBy,
        sort_dir: state.sortDir,
      });
      if (state.q) params.set("q", state.q);
      if (state.department) params.set("department", state.department);
      if (state.status) params.set("status", state.status);

      const data = await api.get(`/api/employees?${params.toString()}`);
      renderTable(area, data);
    } catch (e) {
      area.innerHTML = `<div class="empty-state">Failed to load: ${escapeHtml(e.message)}</div>`;
    }
  }

  function sortIndicator(col) {
    if (state.sortBy !== col) return "";
    return state.sortDir === "asc" ? " ▲" : " ▼";
  }

  function renderTable(area, data) {
    const user = Shell.getUser();
    const canDelete = user?.role === "admin" || user?.role === "manager";

    if (!data.items.length) {
      area.innerHTML = `<div class="empty-state">No employees match your filters.</div>`;
      return;
    }

    const rows = data.items
      .map(
        (e) => `
        <tr>
          <td>${escapeHtml(e.employee_code)}</td>
          <td>${escapeHtml(e.full_name)}</td>
          <td>${escapeHtml(e.email)}</td>
          <td>${escapeHtml(e.department)}</td>
          <td>${escapeHtml(e.designation)}</td>
          <td>₹ ${formatCurrency(e.salary)}</td>
          <td><span class="badge ${e.status.toLowerCase()}">${e.status}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" data-edit="${e.id}">Edit</button>
            ${canDelete ? `<button class="btn btn-danger btn-sm" data-delete="${e.id}" data-name="${escapeHtml(e.full_name)}">Delete</button>` : ""}
          </td>
        </tr>`,
      )
      .join("");

    const totalPages = Math.max(1, Math.ceil(data.total / data.page_size));

    area.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th data-sort="full_name" style="cursor:pointer;">Name${sortIndicator("full_name")}</th>
            <th>Email</th>
            <th data-sort="department" style="cursor:pointer;">Department${sortIndicator("department")}</th>
            <th>Designation</th>
            <th data-sort="salary" style="cursor:pointer;">Salary${sortIndicator("salary")}</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="pagination">
        <span class="page-info">${data.total} result(s) · Page ${data.page} of ${totalPages}</span>
        <button id="prev-page" ${data.page <= 1 ? "disabled" : ""}>‹ Prev</button>
        <button id="next-page" ${data.page >= totalPages ? "disabled" : ""}>Next ›</button>
      </div>
    `;

    area.querySelectorAll("[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const col = th.getAttribute("data-sort");
        if (state.sortBy === col) {
          state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        } else {
          state.sortBy = col;
          state.sortDir = "asc";
        }
        loadResults();
      });
    });

    area.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () =>
        openEditModal(btn.getAttribute("data-edit")),
      );
    });
    area.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", () =>
        handleDelete(
          btn.getAttribute("data-delete"),
          btn.getAttribute("data-name"),
        ),
      );
    });

    const prevBtn = document.getElementById("prev-page");
    const nextBtn = document.getElementById("next-page");
    if (prevBtn)
      prevBtn.addEventListener("click", () => {
        state.page -= 1;
        loadResults();
      });
    if (nextBtn)
      nextBtn.addEventListener("click", () => {
        state.page += 1;
        loadResults();
      });
  }

  async function openEditModal(id) {
    let employee;
    try {
      employee = await api.get(`/api/employees/${id}`);
    } catch (e) {
      toast(e.message, "error");
      return;
    }

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal-box" style="width:600px;">
        <h3>Edit Employee — ${escapeHtml(employee.employee_code)}</h3>
        <form id="edit-form">
          ${window.EmployeeForm.employeeFormHtml({
            ...employee,
            date_of_joining: employee.date_of_joining.slice(0, 10),
          })}
        </form>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="edit-cancel">Cancel</button>
          <button class="btn btn-primary" id="edit-save">Save Changes</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);

    backdrop
      .querySelector("#edit-cancel")
      .addEventListener("click", () => backdrop.remove());

    backdrop.querySelector("#edit-save").addEventListener("click", async () => {
      const data = window.EmployeeForm.readEmployeeForm();
      const errors = window.EmployeeForm.validateEmployeeForm(data);
      window.EmployeeForm.showFormErrors(errors);
      if (Object.keys(errors).length) return;

      const saveBtn = backdrop.querySelector("#edit-save");
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
      try {
        await api.put(`/api/employees/${id}`, data);
        toast("Employee updated.", "success");
        backdrop.remove();
        loadResults();
      } catch (e) {
        toast(e.message, "error");
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Changes";
      }
    });
  }

  async function handleDelete(id, name) {
    const ok = await confirmModal({
      title: "Deactivate employee?",
      message: `${name} will be marked Inactive. You can permanently delete instead from the confirmation that follows if you prefer.`,
      confirmLabel: "Deactivate",
    });
    if (!ok) return;

    try {
      await api.del(`/api/employees/${id}`);
      toast(`${name} deactivated.`, "success");
      loadResults();
    } catch (e) {
      toast(e.message, "error");
    }
  }

  loadResults();
};
