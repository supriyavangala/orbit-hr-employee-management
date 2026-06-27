window.Pages = window.Pages || {};

const DEPARTMENTS = [
  "Engineering",
  "Sales",
  "HR",
  "Finance",
  "Operations",
  "Marketing",
];

function employeeFormHtml(values = {}) {
  const v = (k, d = "") => escapeHtml(values[k] ?? d);
  return `
    <div class="form-grid">
      <div class="field">
        <label>Full Name *</label>
        <input id="f-full_name" type="text" value="${v("full_name")}" placeholder="e.g. Asha Kapoor" />
        <div class="error-text" data-err="full_name"></div>
      </div>
      <div class="field">
        <label>Email *</label>
        <input id="f-email" type="email" value="${v("email")}" placeholder="name@company.com" />
        <div class="error-text" data-err="email"></div>
      </div>
      <div class="field">
        <label>Phone *</label>
        <input id="f-phone" type="text" value="${v("phone")}" placeholder="9876500000" />
        <div class="error-text" data-err="phone"></div>
      </div>
      <div class="field">
        <label>Gender *</label>
        <select id="f-gender">
          ${["Male", "Female", "Other"].map((g) => `<option value="${g}" ${values.gender === g ? "selected" : ""}>${g}</option>`).join("")}
        </select>
        <div class="error-text" data-err="gender"></div>
      </div>
      <div class="field">
        <label>Department *</label>
        <select id="f-department">
          ${DEPARTMENTS.map((d) => `<option value="${d}" ${values.department === d ? "selected" : ""}>${d}</option>`).join("")}
        </select>
        <div class="error-text" data-err="department"></div>
      </div>
      <div class="field">
        <label>Designation *</label>
        <input id="f-designation" type="text" value="${v("designation")}" placeholder="e.g. Backend Developer" />
        <div class="error-text" data-err="designation"></div>
      </div>
      <div class="field">
        <label>Salary (monthly, ₹) *</label>
        <input id="f-salary" type="number" min="1" value="${v("salary")}" placeholder="50000" />
        <div class="error-text" data-err="salary"></div>
      </div>
      <div class="field">
        <label>Date of Joining *</label>
        <input id="f-date_of_joining" type="date" value="${v("date_of_joining")}" />
        <div class="error-text" data-err="date_of_joining"></div>
      </div>
      <div class="field">
        <label>Status</label>
        <select id="f-status">
          ${["Active", "Inactive"].map((s) => `<option value="${s}" ${values.status === s ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </div>
      <div class="field full-span">
        <label>Address</label>
        <textarea id="f-address" rows="2" placeholder="Optional">${v("address")}</textarea>
      </div>
    </div>
  `;
}

function readEmployeeForm() {
  return {
    full_name: document.getElementById("f-full_name").value.trim(),
    email: document.getElementById("f-email").value.trim(),
    phone: document.getElementById("f-phone").value.trim(),
    gender: document.getElementById("f-gender").value,
    department: document.getElementById("f-department").value,
    designation: document.getElementById("f-designation").value.trim(),
    salary: parseFloat(document.getElementById("f-salary").value),
    date_of_joining: document.getElementById("f-date_of_joining").value
      ? `${document.getElementById("f-date_of_joining").value}T00:00:00`
      : "",
    status: document.getElementById("f-status").value,
    address: document.getElementById("f-address").value.trim(),
  };
}

function validateEmployeeForm(data) {
  const errors = {};
  if (!data.full_name || data.full_name.length < 2)
    errors.full_name = "Enter at least 2 characters.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
    errors.email = "Enter a valid email address.";
  if (!/^[0-9+\-\s]{7,20}$/.test(data.phone))
    errors.phone = "Enter a valid phone number.";
  if (!data.designation) errors.designation = "Designation is required.";
  if (!data.salary || data.salary <= 0)
    errors.salary = "Salary must be greater than 0.";
  if (!data.date_of_joining) {
    errors.date_of_joining = "Date of joining is required.";
  } else if (new Date(data.date_of_joining) > new Date()) {
    errors.date_of_joining = "Date of joining cannot be in the future.";
  }
  return errors;
}

function showFormErrors(errors) {
  document
    .querySelectorAll("[data-err]")
    .forEach((el) => (el.textContent = ""));
  Object.entries(errors).forEach(([field, msg]) => {
    const el = document.querySelector(`[data-err="${field}"]`);
    if (el) el.textContent = msg;
  });
}

window.Pages["employee.create"] = function (mount) {
  mount.innerHTML = `
    <h2 class="page-title">Create Employee</h2>
    <div class="card">
      <form id="create-form">${employeeFormHtml({ status: "Active", gender: "Male", department: "Engineering" })}</form>
      <div style="margin-top:18px;display:flex;gap:10px;">
        <button class="btn btn-primary" id="submit-btn">Save Employee</button>
        <button class="btn btn-secondary" id="reset-btn" type="button">Reset</button>
      </div>
    </div>
  `;

  document
    .getElementById("reset-btn")
    .addEventListener("click", () => Shell.navigate("employee.create"));

  document.getElementById("submit-btn").addEventListener("click", async (e) => {
    e.preventDefault();
    const data = readEmployeeForm();
    const errors = validateEmployeeForm(data);
    showFormErrors(errors);
    if (Object.keys(errors).length) return;

    const btn = document.getElementById("submit-btn");
    btn.disabled = true;
    btn.textContent = "Saving...";
    try {
      const created = await api.post("/api/employees", data);
      toast(
        `Employee ${created.full_name} (${created.employee_code}) created.`,
        "success",
      );
      Shell.navigate("employee.search");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Save Employee";
    }
  });
};

// Exported for reuse by the edit modal in search.js
window.EmployeeForm = {
  employeeFormHtml,
  readEmployeeForm,
  validateEmployeeForm,
  showFormErrors,
  DEPARTMENTS,
};
