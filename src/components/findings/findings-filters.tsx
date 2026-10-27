'use client';

import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import type { FindingSort, StateFilter } from '@/lib/utils/findings';

const SEARCH_DELAY_MS = 300;

export function FindingsFilters({
  state,
  sort,
  query,
  canClear,
  onChange,
  onClear,
}: {
  state: StateFilter;
  sort: FindingSort;
  query: string;
  canClear: boolean;
  onChange: (updates: { state?: StateFilter; sort?: FindingSort; query?: string }) => void;
  onClear: () => void;
}) {
  return (
    <div
      role="group"
      aria-label="Filter and sort findings"
      className="flex flex-wrap items-end gap-4"
    >
      <SearchBox initial={query} onSearch={(text) => onChange({ query: text })} />

      <div className="space-y-1">
        <Label htmlFor="finding-state">State</Label>
        <NativeSelect
          id="finding-state"
          value={state}
          onChange={(event) => onChange({ state: event.target.value as StateFilter })}
        >
          <option value="open">Open</option>
          <option value="fixed">Fixed</option>
          <option value="all">All</option>
        </NativeSelect>
      </div>

      <div className="space-y-1">
        <Label htmlFor="finding-sort">Sort by</Label>
        <NativeSelect
          id="finding-sort"
          value={sort}
          onChange={(event) => onChange({ sort: event.target.value as FindingSort })}
        >
          <option value="severity">Severity, high first</option>
          <option value="severity-asc">Severity, low first</option>
          <option value="location">Location</option>
          <option value="rule">Rule ID</option>
        </NativeSelect>
      </div>

      {canClear && (
        <Button variant="ghost" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}

/** Waits a moment after the last key, so the address bar isn't rewritten on every letter. */
function SearchBox({ initial, onSearch }: { initial: string; onSearch: (text: string) => void }) {
  const [text, setText] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className="min-w-56 flex-1 space-y-1 sm:max-w-sm">
      <Label htmlFor="finding-search">Search</Label>
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          id="finding-search"
          type="search"
          autoComplete="off"
          spellCheck={false}
          placeholder="Rule, location or message"
          className="pl-9"
          value={text}
          onChange={(event) => {
            const value = event.target.value;
            setText(value);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => onSearch(value), SEARCH_DELAY_MS);
          }}
        />
      </div>
    </div>
  );
}
