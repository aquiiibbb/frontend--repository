import { describe, it, expect, beforeEach, vi } from "vitest";

// A tiny in-memory stand-in for the backend (/api/store, /api/session/login, /api/public/*)
function makeServer() {
  const store = new Map(); // key -> {value, rev}
  const calls = [];
  const json = (status, body) => ({ ok: status < 400, status, json: async () => body });
  const fetchMock = vi.fn(async (url, opts = {}) => {
    const path = String(url).replace(/^.*\/api/, "");
    const method = opts.method || "GET";
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    calls.push({ method, path, body, auth: opts.headers?.Authorization });
    if (path === "/session/login") return json(200, { success: true, token: "tok", tenantId: "t1", user: { username: body.username, role: "Manager" } });
    if (path === "/store" && method === "GET") return json(200, { entries: Object.fromEntries([...store].map(([k, v]) => [k, v])) });
    if (path === "/store" && method === "PUT") {
      const results = body.changes.map((c) => {
        if (c.value === null) { store.delete(c.key); return { key: c.key, deleted: true }; }
        const rev = (store.get(c.key)?.rev || 0) + 1;
        store.set(c.key, { value: c.value, rev });
        return { key: c.key, rev };
      });
      return json(200, { results });
    }
    if (path === "/store/reset") { store.clear(); return json(200, { success: true }); }
    if (path === "/store/manifest") return json(200, { entries: [...store].map(([key, v]) => ({ key, rev: v.rev })) });
    if (path.startsWith("/public/snapshot")) return json(200, { tenantId: "t1", entries: { hotelpms_room_types_v1: "[1]" } });
    if (path.startsWith("/public/bookings")) return json(200, { success: true });
    return json(404, { message: "not found" });
  });
  return { store, calls, fetchMock };
}

describe("dataStore + backendSync (no localStorage)", () => {
  let server;
  beforeEach(() => {
    vi.resetModules();
    window.sessionStorage.clear();
    server = makeServer();
    globalThis.fetch = server.fetchMock;
  });

  it("never touches localStorage and writes hotel data to the backend", async () => {
    const spy = vi.spyOn(Storage.prototype, "setItem");
    const sync = await import("../services/backendSync");
    const { dataStore } = await import("../services/dataStore");
    const login = await sync.loginToBackend("admin", "pw", "1001");
    expect(login.token).toBe("tok");
    await sync.startSessionAfterLogin({ token: login.token, tenantId: login.tenantId });
    dataStore.setItem("hotelpms_bookings_v1", JSON.stringify([{ id: "B1" }]));
    await sync.settleBackendSync();
    expect(server.store.get("hotelpms_bookings_v1").value).toBe('[{"id":"B1"}]');
    expect(server.calls.find((c) => c.method === "PUT").auth).toBe("Bearer tok");
    expect(window.localStorage.length).toBe(0);
    // only session keys may touch sessionStorage
    spy.mock.calls.forEach(([k]) => expect(["pms_token", "pms_tenant_id", "pms_synced_tenant", "pms_last_hotel", "__pms_probe__"]).toContain(k));
  });

  it("loads existing hotel data from the backend on start", async () => {
    server.store.set("hotelpms_rooms_list_v1", { value: '[{"id":1}]', rev: 3 });
    window.sessionStorage.setItem("pms_token", "tok");
    const sync = await import("../services/backendSync");
    const { dataStore } = await import("../services/dataStore");
    const r = await sync.initBackendSync();
    expect(r.mode).toBe("backend");
    expect(dataStore.getItem("hotelpms_rooms_list_v1")).toBe('[{"id":1}]');
  });

  it("clear() resets the backend store", async () => {
    window.sessionStorage.setItem("pms_token", "tok");
    server.store.set("pms_folios", { value: "{}", rev: 1 });
    const sync = await import("../services/backendSync");
    const { dataStore } = await import("../services/dataStore");
    await sync.initBackendSync();
    dataStore.clear();
    await sync.settleBackendSync();
    expect(server.store.size).toBe(0);
    expect(dataStore.getItem("pms_token")).toBe("tok");
  });

  it("logout forgets the hotel completely", async () => {
    window.sessionStorage.setItem("pms_token", "tok");
    server.store.set("pms_folios", { value: "{}", rev: 1 });
    const sync = await import("../services/backendSync");
    const { dataStore } = await import("../services/dataStore");
    await sync.initBackendSync();
    await sync.logoutFromBackend();
    expect(dataStore.getItem("pms_folios")).toBeNull();
    expect(dataStore.getItem("pms_token")).toBeNull();
  });

  it("public guest booking goes to /public/bookings", async () => {
    window.history.pushState({}, "", "/booking-engine?hotel=t1");
    const sync = await import("../services/backendSync");
    expect((await sync.initBackendSync()).mode).toBe("public");
    await sync.publicCreateBooking({ id: "X" });
    const c = server.calls.find((x) => x.path.startsWith("/public/bookings"));
    expect(c.method).toBe("POST");
    expect(c.auth).toBeUndefined();
    window.history.pushState({}, "", "/");
  });
});
