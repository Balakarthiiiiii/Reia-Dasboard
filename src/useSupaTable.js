import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient";

/**
 * Generic hook for a Supabase table backing one section of the dashboard
 * (sales / overheads / expenses). Keeps a local mirror of rows in state,
 * mapped to/from the app's camelCase shape via toDb/fromDb.
 *
 * Also subscribes to Supabase Realtime so that INSERT/UPDATE/DELETE events
 * made by *any* other browser/device open on this table are pushed to every
 * connected client immediately, without needing a page refresh.
 */
export function useSupaTable(table, toDb, fromDb) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tracks ids we just inserted locally so the realtime INSERT echo for our
  // own write doesn't create a duplicate row in state.
  const recentlyAddedIds = useRef(new Set());

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(`Failed to load ${table}:`, error.message);
      setError(error.message);
      setLoading(false);
      return;
    }
    setRows(data.map(fromDb));
    setError(null);
    setLoading(false);
  }, [table, fromDb]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime subscription: keeps every open tab/device in sync live.
  useEffect(() => {
    const channel = supabase
      .channel(`realtime:${table}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const incomingId = payload.new.id;
            // Skip if this is the echo of a row we just added ourselves.
            if (recentlyAddedIds.current.has(incomingId)) {
              recentlyAddedIds.current.delete(incomingId);
              return;
            }
            setRows((prev) => {
              if (prev.some((r) => r.id === incomingId)) return prev;
              return [fromDb(payload.new), ...prev];
            });
          } else if (payload.eventType === "UPDATE") {
            setRows((prev) =>
              prev.map((r) => (r.id === payload.new.id ? fromDb(payload.new) : r))
            );
          } else if (payload.eventType === "DELETE") {
            setRows((prev) => prev.filter((r) => r.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, fromDb]);

  const add = useCallback(
    async (form) => {
      const payload = toDb(form);
      const { data, error } = await supabase.from(table).insert([payload]).select();
      if (error) {
        console.error(`Failed to add row to ${table}:`, error.message);
        setError(error.message);
        return;
      }
      recentlyAddedIds.current.add(data[0].id);
      setRows((prev) => [fromDb(data[0]), ...prev]);
    },
    [table, toDb, fromDb]
  );

  const remove = useCallback(
    async (id) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) {
        console.error(`Failed to delete row from ${table}:`, error.message);
        setError(error.message);
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
    },
    [table]
  );

  return { rows, add, remove, loading, error, refetch: fetchAll };
}

/**
 * Dedicated hook for the daily 24K gold rate. Unlike sales/overheads/expenses,
 * a rate is keyed by date (one rate per day) and re-entering the same date
 * should UPDATE that day's rate rather than create a duplicate row — so this
 * uses upsert (on the `date` column) instead of a plain insert.
 */
export function useGoldRates() {
  const [rates, setRates] = useState([]); // [{ date: "2026-07-08", rate24k: 7250 }, ...]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("gold_rates")
      .select("*")
      .order("date", { ascending: true });
    if (error) {
      console.error("Failed to load gold_rates:", error.message);
      setError(error.message);
      setLoading(false);
      return;
    }
    setRates(data.map((r) => ({ date: r.date, rate24k: r.rate_24k })));
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const channel = supabase
      .channel("realtime:gold_rates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gold_rates" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setRates((prev) => prev.filter((r) => r.date !== payload.old.date));
            return;
          }
          const incoming = { date: payload.new.date, rate24k: payload.new.rate_24k };
          setRates((prev) => {
            const idx = prev.findIndex((r) => r.date === incoming.date);
            if (idx === -1) return [...prev, incoming].sort((a, b) => a.date.localeCompare(b.date));
            const next = [...prev];
            next[idx] = incoming;
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const upsertRate = useCallback(async (date, rate24k) => {
    const { data, error } = await supabase
      .from("gold_rates")
      .upsert([{ date, rate_24k: rate24k }], { onConflict: "date" })
      .select();
    if (error) {
      console.error("Failed to save gold rate:", error.message);
      setError(error.message);
      return false;
    }
    const saved = { date: data[0].date, rate24k: data[0].rate_24k };
    setRates((prev) => {
      const idx = prev.findIndex((r) => r.date === saved.date);
      if (idx === -1) return [...prev, saved].sort((a, b) => a.date.localeCompare(b.date));
      const next = [...prev];
      next[idx] = saved;
      return next;
    });
    setError(null);
    return true;
  }, []);

  return { rates, upsertRate, loading, error, refetch: fetchAll };
}