/**
 * Tiny API client wrapping fetch().
 * Centralizes auth-header injection and error parsing so individual page
 * modules just call api.get/post/put/del and get back parsed JSON or throw
 * an Error with a human-readable message pulled from the API's `detail`.
 */
const api = (() => {
  function token() {
    return localStorage.getItem("ems_token");
  }

  async function request(method, path, body, isForm) {
    const headers = {};
    const t = token();
    if (t) headers["Authorization"] = `Bearer ${t}`;

    let payload = undefined;
    if (body !== undefined) {
      if (isForm) {
        headers["Content-Type"] = "application/x-www-form-urlencoded";
        payload = new URLSearchParams(body).toString();
      } else {
        headers["Content-Type"] = "application/json";
        payload = JSON.stringify(body);
      }
    }

    const res = await fetch(path, { method, headers, body: payload });

    if (res.status === 401) {
      localStorage.removeItem("ems_token");
      localStorage.removeItem("ems_user");
      if (!path.includes("/auth/login")) {
        window.location.reload();
      }
    }

    const contentType = res.headers.get("content-type") || "";
    if (!res.ok) {
      let detail = `Request failed (${res.status})`;
      if (contentType.includes("application/json")) {
        const data = await res.json().catch(() => null);
        if (data) {
          if (Array.isArray(data.detail)) {
            detail = data.detail.map((d) => d.msg).join(", ");
          } else if (data.detail) {
            detail = data.detail;
          }
        }
      }
      throw new Error(detail);
    }

    if (contentType.includes("application/json")) {
      return res.json();
    }
    return res;
  }

  return {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    postForm: (path, body) => request("POST", path, body, true),
    put: (path, body) => request("PUT", path, body),
    del: (path) => request("DELETE", path),
  };
})();
