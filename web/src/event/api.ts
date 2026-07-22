import type { EventDetail, EventListResponse } from "./types";

const base =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ??
  "";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${path}`);
  }
  return res.json() as Promise<T>;
}

export function fetchEventList() {
  return getJson<EventListResponse>("/api/events");
}

export function fetchEvent(eventId: string) {
  return getJson<EventDetail>(`/api/events/${eventId}`);
}
