import { Search } from "lucide-react";
import { adminButton, adminInput } from "./ui";

/**
 * Plain GET filter bar.
 *
 * Deliberately a native form: the query string is the state, so filters are
 * shareable, bookmarkable, survive a reload and work without JavaScript. The
 * search and filtering themselves happen in PostgreSQL (see
 * `src/lib/admin/queries.ts`), never in the browser.
 */
export function FilterBar({
  action,
  placeholder,
  q,
  selects = [],
}: {
  action: string;
  placeholder: string;
  q?: string;
  selects?: {
    name: string;
    label: string;
    value?: string;
    options: { value: string; label: string }[];
  }[];
}) {
  return (
    <form
      action={action}
      method="get"
      className="flex flex-wrap items-end gap-2.5 border-b border-sandline px-5 py-3.5"
    >
      <div className="min-w-[220px] flex-1">
        <label
          htmlFor="filter-q"
          className="mb-1 block text-[11.5px] font-extrabold uppercase tracking-wider text-ink-faint"
        >
          Search
        </label>
        <input
          id="filter-q"
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder={placeholder}
          className={adminInput}
        />
      </div>

      {selects.map((select) => (
        <div key={select.name}>
          <label
            htmlFor={`filter-${select.name}`}
            className="mb-1 block text-[11.5px] font-extrabold uppercase tracking-wider text-ink-faint"
          >
            {select.label}
          </label>
          <select
            id={`filter-${select.name}`}
            name={select.name}
            defaultValue={select.value ?? ""}
            className={adminInput}
          >
            <option value="">All</option>
            {select.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      <button type="submit" className={adminButton}>
        <Search className="size-3.5" aria-hidden />
        Apply
      </button>
    </form>
  );
}
