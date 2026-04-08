import { api, APIError } from "encore.dev/api";
import log from "encore.dev/log";

interface PingResponse {
  message: string;
}

export const ping = api(
  { method: "GET", expose: true, path: "/api/ping" },
  async (): Promise<PingResponse> => {
    log.info("ping endpoint called");
    return { message: "pong" };
  },
);

interface EchoRequest {
  message: string;
}

interface EchoResponse {
  message: string;
}

export const echo = api(
  { method: "POST", expose: true, path: "/api/echo" },
  async (req: EchoRequest): Promise<EchoResponse> => {
    log.info("echo endpoint called", { message: req.message });
    return { message: req.message };
  },
);

interface TimeResponse {
  time: string;
}

export const time = api(
  { method: "GET", expose: true, path: "/api/time" },
  async (): Promise<TimeResponse> => {
    const now = new Date();
    log.debug("time endpoint called", { timestamp: now.toISOString() });
    return { time: now.toISOString() };
  },
);

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  settings: {
    theme: string;
    notifications: { email: boolean; push: boolean; sms: boolean };
    timezone: string;
  };
  tags: string[];
}

interface UsersResponse {
  users: User[];
  pagination: { page: number; perPage: number; total: number; totalPages: number };
  meta: { requestId: string; latencyMs: number };
}

export const users = api(
  { method: "GET", expose: true, path: "/api/users" },
  async (): Promise<UsersResponse> => {
    log.info("fetching users list", { count: 3 });
    return {
      users: [
        {
          id: 1,
          name: "Alice Johnson",
          email: "alice@example.com",
          role: "admin",
          settings: {
            theme: "dark",
            notifications: { email: true, push: true, sms: false },
            timezone: "America/New_York",
          },
          tags: ["early-adopter", "beta-tester", "premium"],
        },
        {
          id: 2,
          name: "Bob Smith",
          email: "bob@example.com",
          role: "editor",
          settings: {
            theme: "light",
            notifications: { email: true, push: false, sms: false },
            timezone: "Europe/London",
          },
          tags: ["contributor"],
        },
        {
          id: 3,
          name: "Charlie Davis",
          email: "charlie@example.com",
          role: "viewer",
          settings: {
            theme: "system",
            notifications: { email: false, push: false, sms: false },
            timezone: "Asia/Tokyo",
          },
          tags: [],
        },
      ],
      pagination: { page: 1, perPage: 10, total: 3, totalPages: 1 },
      meta: { requestId: crypto.randomUUID(), latencyMs: 12 },
    };
  },
);

import { getAuthData } from "~encore/auth";

interface MeResponse {
  userID: string;
  role: string;
  message: string;
}

export const me = api(
  { method: "GET", expose: true, auth: true, path: "/api/me" },
  async (): Promise<MeResponse> => {
    const auth = getAuthData()!;
    log.info("me endpoint called", { userID: auth.userID, role: auth.role });
    return {
      userID: auth.userID,
      role: auth.role,
      message: `Hello ${auth.userID}, you are an ${auth.role}`,
    };
  },
);

interface GreetRequest {
  name: string;
}

interface GreetResponse {
  greeting: string;
}

export const greet = api(
  { method: "GET", expose: true, path: "/api/greet/:name" },
  async (req: GreetRequest): Promise<GreetResponse> => {
    log.info("greeting user", { name: req.name });
    return { greeting: `Hello, ${req.name}!` };
  },
);

export const fail = api(
  { method: "GET", expose: true, path: "/api/fail" },
  async (): Promise<void> => {
    log.warn("fail endpoint hit, returning not found");
    log.error("simulated error for testing", { endpoint: "/api/fail" });
    throw APIError.notFound("the item you requested does not exist");
  },
);
