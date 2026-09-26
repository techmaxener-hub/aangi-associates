import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { api } from "../lib/api";

interface ResultGroup {
  label: string;
  items: { id: string; title: string; subtitle: string; href: string }[];
}

// One search bar, reused across Admin/Staff/Associate. The PHP endpoints
// do the same role-scoping the old RLS policies did (an Associate's
// clients/tasks query returns only their own rows), but /candidates.php
// is admin/staff-only server-side and now 403s for an Associate rather
// than silently returning zero rows — Promise.allSettled so that one
// rejection doesn't blank out the other three result groups.
export function GlobalSearch({ basePath }: { basePath: string }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<ResultGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Ctrl/Cmd+K jumps straight to search from anywhere in the portal — the
  // same shortcut most people already know from other tools, so search
  // becomes the fast way in rather than something tucked in the header.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setGroups([]);
      return;
    }

    setLoading(true);
    const timer = window.setTimeout(() => {
      const q = encodeURIComponent(term);

      void Promise.allSettled([
        api.get<{ id: string; full_name: string; phone: string }[]>(`/clients.php?search=${q}`),
        api.get<{ id: string; full_name: string; phone: string; track: string }[]>(`/candidates.php?search=${q}`),
        api.get<{ id: string; full_name: string; phone: string; status: string }[]>(`/leads.php?search=${q}`),
        // tasks.php has no ?search= param — filter the (already role-scoped)
        // list client-side instead of adding a narrow endpoint mode for it.
        api
          .get<{ id: string; title: string; status: string }[]>("/tasks.php")
          .then((tasks) => (tasks ?? []).filter((t) => t.title.toLowerCase().includes(term.toLowerCase()))),
      ]).then(([clients, candidates, leads, tasks]) => {
        const next: ResultGroup[] = [];

        if (clients.status === "fulfilled" && clients.value?.length) {
          next.push({
            label: "Clients",
            items: clients.value.slice(0, 5).map((c) => ({
              id: c.id,
              title: c.full_name,
              subtitle: c.phone,
              href: `${basePath}/clients/${c.id}`,
            })),
          });
        }
        if (candidates.status === "fulfilled" && candidates.value?.length) {
          next.push({
            label: "Onboarding",
            items: candidates.value.slice(0, 5).map((c) => ({
              id: c.id,
              title: c.full_name,
              subtitle: `${c.track} · ${c.phone}`,
              href: `${basePath}/team/${c.id}`,
            })),
          });
        }
        if (leads.status === "fulfilled" && leads.value?.length) {
          next.push({
            label: "Leads",
            items: leads.value.slice(0, 5).map((l) => ({
              id: l.id,
              title: l.full_name,
              subtitle: `${l.status} · ${l.phone}`,
              href: `${basePath}/leads`,
            })),
          });
        }
        if (tasks.status === "fulfilled" && tasks.value?.length) {
          next.push({
            label: "Tasks",
            items: tasks.value.slice(0, 5).map((t) => ({
              id: t.id,
              title: t.title,
              subtitle: t.status.replace("_", " "),
              href: `${basePath}/tasks`,
            })),
          });
        }

        setGroups(next);
        setLoading(false);
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query, basePath]);

  const hasResults = groups.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 rounded-md border border-line-strong bg-surface-2 px-3 py-2.5 focus-within:border-crimson">
        <Search className="h-4 w-4 shrink-0 text-text-soft" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search clients, leads, tasks…"
          className="w-full bg-transparent text-sm text-text placeholder:text-text-soft focus:outline-none"
        />
        <kbd className="hidden shrink-0 rounded border border-line-strong px-1.5 py-0.5 font-mono text-[10px] text-text-soft sm:block">
          Ctrl K
        </kbd>
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-md border border-line bg-surface shadow-raised">
          {loading ? (
            <p className="p-3 text-sm text-text-soft">Searching…</p>
          ) : !hasResults ? (
            <p className="p-3 text-sm text-text-soft">No matches for "{query}".</p>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="border-b border-line last:border-b-0">
                <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-text-soft">
                  {group.label}
                </p>
                {group.items.map((item) => (
                  <Link
                    key={item.id}
                    to={item.href}
                    onClick={() => {
                      setOpen(false);
                      setQuery("");
                      navigate(item.href);
                    }}
                    className="block px-3 py-2 text-sm hover:bg-surface-2"
                  >
                    <p className="text-text">{item.title}</p>
                    <p className="text-xs capitalize text-text-soft">{item.subtitle}</p>
                  </Link>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
