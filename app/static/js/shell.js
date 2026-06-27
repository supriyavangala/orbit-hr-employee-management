/**
 * App shell.
 *
 * This is a small hand-rolled SPA router (no framework) so the whole app
 * is one HTML document. Each "page" is rendered by a function in window.Pages
 * (see pages/*.js) into #main-content, keyed by a route string like
 * "employee.search" or "more.autocomplete".
 */
const Shell = (() => {
  let currentUser = null;

  const NAV = [
    { id: "home", label: "Home", icon: "🏠" },
    {
      id: "employee",
      label: "Employee",
      icon: "👥",
      children: [
        { id: "employee.create", label: "Create" },
        { id: "employee.search", label: "Search" },
      ],
    },
    {
      id: "more",
      label: "More",
      icon: "▤",
      children: [
        { id: "more.tabs", label: "Multiple Tabs" },
        { id: "more.menu", label: "Menu" },
        { id: "more.autocomplete", label: "Autocomplete" },
        { id: "more.collapsible", label: "Collapsible Content" },
        { id: "more.images", label: "Images" },
        { id: "more.slider", label: "Slider" },
        { id: "more.tooltips", label: "Tooltips" },
        { id: "more.popups", label: "Popups" },
        { id: "more.links", label: "Links" },
        { id: "more.css", label: "CSS Properties" },
        { id: "more.iframes", label: "iFrames" },
      ],
    },
    {
      id: "settings",
      label: "Settings",
      icon: "⚙",
      children: [
        { id: "settings.password", label: "Change Password" },
        { id: "settings.users", label: "Manage Users" },
        { id: "settings.audit", label: "Activity Log" },
        { id: "settings.theme", label: "Appearance" },
      ],
    },
  ];

  function getUser() {
    if (currentUser) return currentUser;
    const raw = localStorage.getItem("ems_user");
    currentUser = raw ? JSON.parse(raw) : null;
    return currentUser;
  }

  function setUser(user) {
    currentUser = user;
    localStorage.setItem("ems_user", JSON.stringify(user));
  }

  function isLoggedIn() {
    return !!localStorage.getItem("ems_token") && !!getUser();
  }

  function logout() {
    localStorage.removeItem("ems_token");
    localStorage.removeItem("ems_user");
    currentUser = null;
    render();
  }

  function applyTheme() {
    const user = getUser();
    document.documentElement.setAttribute(
      "data-theme",
      user?.theme === "dark" ? "dark" : "light",
    );
  }

  function navigate(route) {
    window.location.hash = route;
  }

  function buildSidebar(activeRoute) {
    const topId = activeRoute.split(".")[0];
    const user = getUser();
    const initials = (user?.username || "?").slice(0, 2).toUpperCase();

    const navHtml = NAV.map((item) => {
      const isParentActive = item.id === topId;
      if (!item.children) {
        return `<div class="nav-item ${isParentActive ? "active" : ""}" data-route="${item.id}">
                  <span>${item.icon}</span><span>${item.label}</span>
                </div>`;
      }
      const childrenHtml = item.children
        .map(
          (c) =>
            `<div class="sub-item ${activeRoute === c.id ? "active" : ""}" data-route="${c.id}">${c.label}</div>`,
        )
        .join("");
      return `
        <div class="nav-item ${isParentActive ? "expanded" : ""}" data-toggle="${item.id}">
          <span>${item.icon}</span><span>${item.label}</span><span class="chev">▶</span>
        </div>
        <div class="sub-nav ${isParentActive ? "open" : ""}" data-group="${item.id}">${childrenHtml}</div>`;
    }).join("");

    return `
      <div class="sidebar-profile">
        <div class="avatar">${initials}</div>
        <div>
          <div class="who-name">${escapeHtml(user?.username || "Guest")}</div>
          <div class="who-role">${escapeHtml(user?.role || "")}</div>
        </div>
      </div>
      <div class="nav-section">${navHtml}</div>`;
  }

  function wireSidebar(root, activeRoute) {
    root.querySelectorAll("[data-toggle]").forEach((el) => {
      el.addEventListener("click", () => {
        const group = el.getAttribute("data-toggle");
        const topId = activeRoute.split(".")[0];
        // If clicking the already-active section, just toggle open/closed visually;
        // otherwise navigate to the first child of that section.
        const subnav = root.querySelector(`[data-group="${group}"]`);
        if (topId === group) {
          subnav.classList.toggle("open");
          el.classList.toggle("expanded");
        } else {
          const firstChild = NAV.find((n) => n.id === group)?.children?.[0];
          if (firstChild) navigate(firstChild.id);
        }
      });
    });
    root.querySelectorAll("[data-route]").forEach((el) => {
      el.addEventListener("click", () =>
        navigate(el.getAttribute("data-route")),
      );
    });
  }

  function renderLogin() {
    document.getElementById("app-root").innerHTML = `
      <div class="login-wrap">
        <div class="login-card">
          <h2>Orbit HR</h2>
          <div class="muted" style="margin-bottom:18px;font-size:13.5px;">Employee Management System</div>
          <div class="field" style="margin-bottom:12px;">
            <label>Username</label>
            <input id="login-username" type="text" placeholder="admin" />
          </div>
          <div class="field" style="margin-bottom:6px;">
            <label>Password</label>
            <input id="login-password" type="password" placeholder="••••••••" />
          </div>
          <div class="error-text" id="login-error"></div>
          <button class="btn btn-primary" id="login-btn" style="width:100%;margin-top:10px;">Sign In</button>
          <div class="hint">
            Demo accounts:<br/>
            <b>admin</b> / Admin@123 (full access)<br/>
            <b>manager</b> / Manager@123<br/>
            <b>staff</b> / Staff@123 (read-mostly)
          </div>
        </div>
      </div>`;

    const doLogin = async () => {
      const username = document.getElementById("login-username").value.trim();
      const password = document.getElementById("login-password").value;
      const errEl = document.getElementById("login-error");
      errEl.textContent = "";
      if (!username || !password) {
        errEl.textContent = "Please enter both username and password.";
        return;
      }
      try {
        const data = await api.postForm("/api/auth/login", {
          username,
          password,
        });
        localStorage.setItem("ems_token", data.access_token);
        setUser(data.user);
        navigate("home");
        render();
      } catch (e) {
        errEl.textContent = e.message || "Login failed";
      }
    };

    document.getElementById("login-btn").addEventListener("click", doLogin);
    document
      .getElementById("login-password")
      .addEventListener("keydown", (e) => {
        if (e.key === "Enter") doLogin();
      });
  }

  function renderShell(route) {
    applyTheme();
    document.getElementById("app-root").innerHTML = `
      <div id="app-shell">
        <div class="topbar">
          <div class="brand">Orbit HR</div>
          <button class="logout-btn" id="logout-btn">Logout</button>
        </div>
        <div class="body-row">
          <div class="sidebar" id="sidebar"></div>
          <div class="main-content" id="main-content"></div>
        </div>
      </div>
      <div id="toast-stack"></div>`;

    document.getElementById("sidebar").innerHTML = buildSidebar(route);
    wireSidebar(document.getElementById("sidebar"), route);
    document.getElementById("logout-btn").addEventListener("click", logout);

    const [section, sub] = route.split(".");
    const pageKey = sub ? route : section;
    const renderer = window.Pages?.[pageKey] || window.Pages?.[section];
    const mount = document.getElementById("main-content");
    if (renderer) {
      renderer(mount);
    } else {
      mount.innerHTML = `<div class="empty-state">Page not found.</div>`;
    }
  }

  function render() {
    if (!isLoggedIn()) {
      renderLogin();
      return;
    }
    let route = window.location.hash.replace("#", "") || "home";
    renderShell(route);
  }

  window.addEventListener("hashchange", render);

  return { render, navigate, getUser, setUser, applyTheme };
})();

document.addEventListener("DOMContentLoaded", () => Shell.render());
