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