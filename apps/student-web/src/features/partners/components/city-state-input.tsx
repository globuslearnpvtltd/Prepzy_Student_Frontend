'use client';

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { formatCity, suggestCities, type IndianCity } from '../cities';

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className: string;
}

/** Free text still works for towns not in the list; the dropdown just fills "City, State" for the rest. */
export function CityStateInput({ id, value, onChange, onBlur, placeholder, className }: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const suggestions = useMemo(() => suggestCities(value), [value]);
  const listId = `${id}-options`;
  const showList = open && suggestions.length > 0;

  useEffect(() => {
    if (showList) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [showList, activeIndex, listId]);

  const select = (city: IndianCity) => {
    onChange(formatCity(city));
    setOpen(false);
  };

  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showList) {
      if (event.key === 'ArrowDown' && suggestions.length > 0) {
        setOpen(true);
        setActiveIndex(0);
        event.preventDefault();
      }
      return;
    }
    if (event.key === 'ArrowDown') setActiveIndex((i) => (i + 1) % suggestions.length);
    else if (event.key === 'ArrowUp') setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    else if (event.key === 'Enter') select(suggestions[activeIndex]!); // picks the city instead of submitting
    else if (event.key === 'Escape') setOpen(false);
    else return;
    event.preventDefault();
  };

  return (
    <div className="relative w-full">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          onBlur?.();
        }}
        onKeyDown={keyDown}
        placeholder={placeholder}
        className={className}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="border-partner-input-line bg-neutral-0 absolute top-[calc(100%+6px)] right-0 left-0 z-20 m-0 max-h-[300px] list-none overflow-y-auto rounded-[14px] border-[1px] border-solid p-[6px] shadow-[0px_10px_28px_0px_rgba(36,29,82,0.14)]"
        >
          {suggestions.map((city, i) => (
            <li
              key={`${city.city}-${city.state}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              // mousedown would blur the input and close the list before the click lands.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(city)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-[12px] rounded-[10px] px-[14px] py-[10px] ${i === activeIndex ? 'bg-partner-chip' : ''}`}
            >
              <span className="text-partner-ink shrink-0 text-[16px] font-semibold">{city.city}</span>
              <span className="text-partner-muted min-w-0 text-right text-[14px]">{city.state}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
