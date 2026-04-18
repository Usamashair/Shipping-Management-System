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
import { useAuth } from "@/lib/auth/context";
import type {
  CreateShipmentInput,
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
  createUser: (input: CreateUserInput) => Promise<void>;
  updateUser: (id: number, input: UpdateUserInput) => Promise<void>;
  deleteUser: (id: number) => Promise<void>;
  listShipments: (opts?: { scope: "all" | "mine"; customerId?: number }) => Shipment[];
  refreshShipments: (scope: "all" | "mine") => Promise<void>;
  getShipment: (id: number) => Shipment | undefined;
  loadShipment: (id: number) => Promise<void>;
  createShipment: (input: CreateShipmentInput) => Promise<Shipment>;
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
      const s = normalizeShipment(await apiFetch<Shipment>(path, { token }));
      setShipmentById((prev) => ({ ...prev, [id]: s }));
    },
    [token, user],
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
      if (!token) return;
      await apiFetch("/api/admin/users", {
        method: "POST",
        token,
        body: input,
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

  const updateUser = useCallback(
    async (id: number, input: UpdateUserInput) => {
      if (!token) return;
      await apiFetch(`/api/admin/users/${id}`, {
        method: "PUT",
        token,
        body: input,
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

  const deleteUser = useCallback(
    async (id: number) => {
      if (!token) return;
      await apiFetch(`/api/admin/users/${id}`, { method: "DELETE", token });
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

  const createShipment = useCallback(
    async (input: CreateShipmentInput) => {
      if (!token) throw new Error("Not authenticated");
      const body = {
        sender_details: input.sender_details,
        receiver_details: input.receiver_details,
        package_details: input.package_details,
      };
      const created = normalizeShipment(
        await apiFetch<Shipment>("/api/customer/shipments", {
          method: "POST",
          token,
          body,
        }),
      );
      setShipmentById((prev) => ({ ...prev, [created.id]: created }));
      await refreshShipments("mine");
      return created;
    },
    [token, refreshShipments],
  );

  const updateShipmentStatus = useCallback(
    async (id: number, status: ShipmentStatus) => {
      if (!token) return;
      const updated = normalizeShipment(
        await apiFetch<Shipment>(`/api/admin/shipments/${id}/status`, {
          method: "PATCH",
          token,
          body: { status },
        }),
      );
      setShipmentById((prev) => ({ ...prev, [id]: updated }));
      await refreshShipments("all");
    },
    [token, refreshShipments],
  );

  const trackShipment = useCallback(
    async (shipmentId: number) => {
      if (!token) return;
      const updated = normalizeShipment(
        await apiFetch<Shipment>(`/api/customer/shipments/${shipmentId}/track`, {
          method: "POST",
          token,
        }),
      );
      setShipmentById((prev) => ({ ...prev, [shipmentId]: updated }));
      await refreshShipments("mine");
    },
    [token, refreshShipments],
  );

  const value = useMemo<ApiStoreValue>(
    () => ({
      listUsers,
      refreshUsers,
      createUser,
      updateUser,
      deleteUser,
      listShipments,
      refreshShipments,
      getShipment,
      loadShipment,
      createShipment,
      updateShipmentStatus,
      getTrackingLogs,
      trackShipment,
    }),
    [
      listUsers,
      refreshUsers,
      createUser,
      updateUser,
      deleteUser,
      listShipments,
      refreshShipments,
      getShipment,
      loadShipment,
      createShipment,
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
