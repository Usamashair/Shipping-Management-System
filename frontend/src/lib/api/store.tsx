"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, apiFetch } from "@/lib/api/client";
import { unwrapDataRecord } from "@/lib/api/laravel-resource";
import { useAuth } from "@/lib/auth/context";
import type {
  CreateAdminShipmentInput,
  CreateUserInput,
  Shipment,
  ShipmentStatus,
  TrackingLog,
  UpdateUserInput,
  User,
} from "@/lib/types";

type Paginated<T> = {
  data: T[];
};

type ApiStoreValue = {
  listUsers: () => User[];
  refreshUsers: () => Promise<void>;
  getUser: (id: number) => User | undefined;
  loadUser: (id: number) => Promise<User>;
  createUser: (input: CreateUserInput) => Promise<User>;
  updateUser: (id: number, input: UpdateUserInput) => Promise<void>;
  deleteUser: (id: number) => Promise<void>;
  listShipments: (opts?: { scope: "all" | "mine"; customerId?: number }) => Shipment[];
  refreshShipments: (scope: "all" | "mine") => Promise<void>;
  getShipment: (id: number) => Shipment | undefined;
  loadShipment: (id: number) => Promise<void>;
  createAdminShipment: (input: CreateAdminShipmentInput) => Promise<Shipment>;
  updateShipmentStatus: (id: number, status: ShipmentStatus) => Promise<void>;
  getTrackingLogs: (shipmentId: number) => TrackingLog[];
  trackShipment: (shipmentId: number) => Promise<void>;
};

const ApiStoreContext = createContext<ApiStoreValue | null>(null);

function normalizeShipment(s: Shipment): Shipment {
  const raw = (s as unknown as { tracking_logs?: unknown }).tracking_logs;
  const logs = Array.isArray(raw) ? (raw as TrackingLog[]) : [];

  return {
    ...s,
    tracking_logs: logs,
  };
}

export function ApiStoreProvider({ children }: { children: ReactNode }) {
  const { token, user, logout } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [userById, setUserById] = useState<Record<number, User>>({});
  const [adminShipments, setAdminShipments] = useState<Shipment[]>([]);
  const [myShipments, setMyShipments] = useState<Shipment[]>([]);
  const [shipmentById, setShipmentById] = useState<Record<number, Shipment>>({});

  const refreshUsers = useCallback(async () => {
    if (!token) return;
    const res = await apiFetch<Paginated<User>>("/api/admin/users?per_page=100", { token });
    setUsers(res.data);
  }, [token]);

  const refreshShipments = useCallback(
    async (scope: "all" | "mine") => {
      if (!token) return;
      if (scope === "all") {
        const res = await apiFetch<Paginated<Shipment>>("/api/admin/shipments?per_page=100", {
          token,
        });
        const rows = res.data.map(normalizeShipment);
        setAdminShipments(rows);
        setShipmentById((prev) => {
          const next = { ...prev };
          for (const s of rows) next[s.id] = s;
          return next;
        });
      } else {
        const res = await apiFetch<Paginated<Shipment>>("/api/customer/shipments?per_page=100", {
          token,
        });
        const rows = res.data.map(normalizeShipment);
        setMyShipments(rows);
        setShipmentById((prev) => {
          const next = { ...prev };
          for (const s of rows) next[s.id] = s;
          return next;
        });
      }
    },
    [token],
  );

  const loadShipment = useCallback(
    async (id: number) => {
      if (!token || !user) return;
      const path =
        user.role === "admin"
          ? `/api/admin/shipments/${id}`
          : `/api/customer/shipments/${id}`;
      const raw = await apiFetch<unknown>(path, { token });
      const s = normalizeShipment(unwrapDataRecord<Shipment>(raw));
      setShipmentById((prev) => ({ ...prev, [id]: s }));
    },
    [token, user],
  );

  const getUser = useCallback(
    (id: number) => userById[id] ?? users.find((u) => u.id === id),
    [userById, users],
  );

  const loadUser = useCallback(
    async (id: number) => {
      if (!token) throw new Error("Not authenticated");
      const raw = await apiFetch<unknown>(`/api/admin/users/${id}`, { token });
      const u = unwrapDataRecord<User>(raw);
      setUserById((prev) => ({ ...prev, [id]: u }));
      setUsers((prev) => {
        const idx = prev.findIndex((x) => x.id === u.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = u;
          return next;
        }
        return prev;
      });
      return u;
    },
    [token],
  );

  const listUsers = useCallback(() => users, [users]);

  const listShipments = useCallback(
    (opts?: { scope: "all" | "mine"; customerId?: number }) => {
      const scope = opts?.scope ?? "all";
      return scope === "all" ? adminShipments : myShipments;
    },
    [adminShipments, myShipments],
  );

  const getShipment = useCallback(
    (id: number) => shipmentById[id],
    [shipmentById],
  );

  const getTrackingLogs = useCallback(
    (shipmentId: number) => {
      const s = shipmentById[shipmentId];
      return Array.isArray(s?.tracking_logs) ? s.tracking_logs : [];
    },
    [shipmentById],
  );

  const createUser = useCallback(
    async (input: CreateUserInput) => {
      if (!token) throw new Error("Not authenticated");
      const raw = await apiFetch<unknown>("/api/admin/users", {
        method: "POST",
        token,
        body: input,
      });
      const created = unwrapDataRecord<User>(raw);
      setUserById((prev) => ({ ...prev, [created.id]: created }));
      try {
        await refreshUsers();
      } catch (e) {
        if (e instanceof ApiError && e.status === 403) {
          await logout();
          window.location.assign("/login");
          throw e;
        }
        throw e;
      }
      return created;
    },
    [token, refreshUsers, logout],
  );

  const updateUser = useCallback(
    async (id: number, input: UpdateUserInput) => {
      if (!token) return;
      const raw = await apiFetch<unknown>(`/api/admin/users/${id}`, {
        method: "PUT",
        token,
        body: input,
      });
      const updated = unwrapDataRecord<User>(raw);
      setUserById((prev) => ({ ...prev, [id]: updated }));
      try {
        await refreshUsers();
      } catch (e) {
        if (e instanceof ApiError && e.status === 403) {
          await logout();
          window.location.assign("/login");
          return;
        }
        throw e;
      }
    },
    [token, refreshUsers, logout],
  );

  const deleteUser = useCallback(
    async (id: number) => {
      if (!token) return;
      await apiFetch(`/api/admin/users/${id}`, { method: "DELETE", token });
      setUserById((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      try {
        await refreshUsers();
      } catch (e) {
        if (e instanceof ApiError && e.status === 403) {
          await logout();
          window.location.assign("/login");
          return;
        }
        throw e;
      }
    },
    [token, refreshUsers, logout],
  );

  const createAdminShipment = useCallback(
    async (input: CreateAdminShipmentInput) => {
      if (!token) throw new Error("Not authenticated");
      const raw = await apiFetch<unknown>("/api/admin/shipments", {
        method: "POST",
        token,
        body: input,
      });
      const created = normalizeShipment(unwrapDataRecord<Shipment>(raw));
      setShipmentById((prev) => ({ ...prev, [created.id]: created }));
      await refreshShipments("all");
      return created;
    },
    [token, refreshShipments],
  );

  const updateShipmentStatus = useCallback(
    async (id: number, status: ShipmentStatus) => {
      if (!token) return;
      const raw = await apiFetch<unknown>(`/api/admin/shipments/${id}/status`, {
        method: "PATCH",
        token,
        body: { status },
      });
      const updated = normalizeShipment(unwrapDataRecord<Shipment>(raw));
      setShipmentById((prev) => ({ ...prev, [id]: updated }));
      await refreshShipments("all");
    },
    [token, refreshShipments],
  );

  const trackShipment = useCallback(
    async (shipmentId: number) => {
      if (!token) return;
      const raw = await apiFetch<unknown>(`/api/customer/shipments/${shipmentId}/track`, {
        method: "POST",
        token,
      });
      const updated = normalizeShipment(unwrapDataRecord<Shipment>(raw));
      setShipmentById((prev) => ({ ...prev, [shipmentId]: updated }));
      await refreshShipments("mine");
    },
    [token, refreshShipments],
  );

  const value = useMemo<ApiStoreValue>(
    () => ({
      listUsers,
      refreshUsers,
      getUser,
      loadUser,
      createUser,
      updateUser,
      deleteUser,
      listShipments,
      refreshShipments,
      getShipment,
      loadShipment,
      createAdminShipment,
      updateShipmentStatus,
      getTrackingLogs,
      trackShipment,
    }),
    [
      listUsers,
      refreshUsers,
      getUser,
      loadUser,
      createUser,
      updateUser,
      deleteUser,
      listShipments,
      refreshShipments,
      getShipment,
      loadShipment,
      createAdminShipment,
      updateShipmentStatus,
      getTrackingLogs,
      trackShipment,
    ],
  );

  return <ApiStoreContext.Provider value={value}>{children}</ApiStoreContext.Provider>;
}

export function useApiStore() {
  const ctx = useContext(ApiStoreContext);
  if (!ctx) throw new Error("useApiStore must be used within ApiStoreProvider");
  return ctx;
}
