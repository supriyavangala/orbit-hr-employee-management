window.Pages = window.Pages || {};

window.Pages.home = async function (mount) {
  mount.innerHTML = `<div class="empty-state">Loading dashboard...</div>`;
  try {
    const [stats, announcements] = await Promise.all([
      api.get("/api/dashboard/stats"),
      api.get("/api/announcements"),
    ]);

    const deptRows = stats.by_department
      .map(
        (d) =>
          `<tr><td>${escapeHtml(d.department)}</td><td>${d.count}</td></tr>`,
      )
      .join("");

    const recentRows = stats.recent_hires
      .map(
        (e) => `<tr>
          <td>${escapeHtml(e.employee_code)}</td>
          <td>${escapeHtml(e.full_name)}</td>
          <td>${escapeHtml(e.department)}</td>
          <td>${formatDate(e.date_of_joining)}</td>
        </tr>`,
      )
      .join("");

    const announcementHtml =
      announcements
        .slice(0, 3)
        .map(
          (a) => `<div style="margin-bottom:10px;">
          <div style="font-weight:600;font-size:14px;">${escapeHtml(a.title)}</div>
          <div class="muted" style="font-size:13px;">${escapeHtml(a.body)}</div>
        </div>`,
        )
        .join("") || `<div class="muted">No announcements yet.</div>`;

    mount.innerHTML = `
      <h2 class="page-title">Welcome back, ${escapeHtml(Shell.getUser()?.username || "")}</h2>

      <div class="grid-3" style="margin-bottom:18px;">
        <div class="stat-card">
          <div class="num">${stats.total_employees}</div>
          <div class="label">Total Employees</div>
        </div>
        <div class="stat-card">
          <div class="num">${stats.active_employees} / ${stats.inactive_employees}</div>
          <div class="label">Active / Inactive</div>
        </div>
        <div class="stat-card">
          <div class="num">₹ ${formatCurrency(stats.total_monthly_salary)}</div>
          <div class="label">Total Monthly Payroll (active staff)</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:18px;align-items:start;">
        <div class="card">
          <h3>Employees by Department</h3>
          <table>
            <thead><tr><th>Department</th><th>Count</th></tr></thead>
            <tbody>${deptRows || `<tr><td colspan="2" class="muted">No data yet.</td></tr>`}</tbody>
          </table>

          <h3 style="margin-top:24px;">Recent Hires</h3>
          <table>
            <thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Joined</th></tr></thead>
            <tbody>${recentRows || `<tr><td colspan="4" class="muted">No employees yet.</td></tr>`}</tbody>
          </table>
        </div>

        <div class="card">
          <h3>Announcements</h3>
          ${announcementHtml}
        </div>
      </div>
    `;
  } catch (e) {
    mount.innerHTML = `<div class="empty-state">Could not load dashboard: ${escapeHtml(e.message)}</div>`;
  }
};
