import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { supabase } from "../lib/supabase";

interface ResultGroup {
  label: string;
  items: { id: string; title: string; subtitle: string; href: string }[];
}

// One search bar, reused across Admin/Staff/Associate. RLS already scopes
// every one of these queries to what the signed-in role/user can see (an
// Associate's clients/tasks query returns only their own rows; Candidates
// returns nothing at all for an Associate, since that table has no
// associate-facing policy) -- so this component needs no role branching.
export function GlobalSearch({ basePath }: { basePath: string }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<ResultGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setGroups([]);
      return;
    }

    setLoading(true);
    const timer = window.setTimeout(() => {
      const pattern = `%${term}%`;

      void Promise.all([
        supabase
          .from("clients")
          .select("id, full_name, phone")
          .or(`full_name.ilike.${pattern},phone.ilike.${pattern}`)
          .limit(5),
        supabase
          .from("candidates")
          .select("id, full_name, phone, track")
          .or(`full_name.ilike.${pattern},phone.ilike.${pattern}`)
          .limit(5),
        supabase
          .from("leads")
          .select("id, full_name, phone, status")
          .or(`full_name.ilike.${pattern},phone.ilike.${pattern}`)
          .limit(5),
        supabase.from("tasks").select("id, title, status").ilike("title", pattern).limit(5),
      ]).then(([clients, candidates, leads, tasks]) => {
        const next: ResultGroup[] = [];

        if (clients.data?.length) {
          next.push({
            label: "Clients",
            items: clients.data.map((c) => ({
              id: c.id,
              title: c.full_name,
              subtitle: c.phone,
              href: `${basePath}/clients/${c.id}`,
            })),
          });
        }
        if (candidates.data?.length) {
          next.push({
            label: "Onboarding",
            items: candidates.data.map((c) => ({
              id: c.id,
              title: c.full_name,
              subtitle: `${c.track} · ${c.phone}`,
              href: `${basePath}/team/${c.id}`,
            })),
          });
        }
        if (leads.data?.length) {
          next.push({
            label: "Leads",
            items: leads.data.map((l) => ({
              id: l.id,
              title: l.full_name,
              subtitle: `${l.status} · ${l.phone}`,
              href: `${basePath}/leads`,
            })),
          });
        }
        if (tasks.data?.length) {
          next.push({
            label: "Tasks",
            items: tasks.data.map((t) => ({
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
      <div className="flex items-center gap-2 rounded-md border border-line-strong bg-surface-2 px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-text-soft" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search clients, leads, tasks…"
          className="w-full bg-transparent text-sm text-text placeholder:text-text-soft focus:outline-none"
        />
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
