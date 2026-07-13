import { useState, useRef, useEffect, useId, useMemo } from "react";
import { FaCheckCircle } from "react-icons/fa";

/**
 * @component AutocompleteField
 * @description Custom autocomplete input that filters suggestions as user types.
 * Shows max 6 filtered results. Allows free text (not restricted to suggestions).
 * Uses same visual style as SelectField dropdown.
 */
const AutocompleteField = ({
  id,
  name,
  value,
  onChange,
  suggestions = [],
  placeholder = "",
  icon,
  isValid = false,
  stateClass = "",
  onKeyDown: externalKeyDown,
  ...rest
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  // Filter suggestions by input value — max 6 results
  const filtered = useMemo(
    () =>
      value && value.length > 0
        ? suggestions
            .filter((s) => s.toLowerCase().includes(value.toLowerCase()))
            .slice(0, 6)
        : [],
    [suggestions, value],
  );

  // Don't show dropdown if exact match already selected
  const exactMatch =
    filtered.length === 1 &&
    filtered[0].toLowerCase() === value.toLowerCase();
  const showDropdown = isOpen && filtered.length > 0 && !exactMatch;

  /* ── Select a suggestion ────────────────────────────────────── */
  const handleSelect = (suggestion) => {
    onChange({ target: { name, value: suggestion } });
    setIsOpen(false);
    setFocusedIndex(-1);
    inputRef.current?.focus();
  };

  /* ── Handle input change ────────────────────────────────────── */
  const handleInputChange = (e) => {
    onChange(e);
    setIsOpen(true);
    setFocusedIndex(-1);
  };

  /* ── Keyboard navigation ────────────────────────────────────── */
  const handleKeyDown = (e) => {
    if (showDropdown) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) =>
            Math.min(prev + 1, filtered.length - 1),
          );
          return;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          return;
        case "Enter":
          if (focusedIndex >= 0 && focusedIndex < filtered.length) {
            e.preventDefault();
            handleSelect(filtered[focusedIndex]);
            return;
          }
          break;
        case "Escape":
          setIsOpen(false);
          setFocusedIndex(-1);
          return;
        default:
          break;
      }
    }
    // Pass through to external handler
    externalKeyDown?.(e);
  };

  /* ── Scroll focused option into view ────────────────────────── */
  useEffect(() => {
    if (!showDropdown || focusedIndex < 0) return;
    const item = listRef.current?.children[focusedIndex];
    item?.scrollIntoView({ block: "nearest" });
  }, [focusedIndex, showDropdown]);

  /* ── Close on outside click ─────────────────────────────────── */
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (!containerRef.current?.contains(e.target)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  /* ── Highlight matching text ────────────────────────────────── */
  const highlightMatch = (text, query) => {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span className="autocomplete-match">
          {text.slice(idx, idx + query.length)}
        </span>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`autocomplete-wrapper${showDropdown ? " is-open" : ""}`}
    >
      <div
        className={`neuro-input-wrapper premium-input ${stateClass}`}
      >
        {icon}
        <input
          ref={inputRef}
          id={id}
          type="text"
          name={name}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showDropdown && focusedIndex >= 0
              ? `${listId}-opt-${focusedIndex}`
              : undefined
          }
          autoComplete="off"
          {...rest}
        />
        {isValid && (
          <FaCheckCircle className="valid-icon" aria-hidden="true" />
        )}
      </div>

      {showDropdown && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="autocomplete-list"
          aria-label={placeholder}
        >
          {filtered.map((suggestion, i) => (
            <li
              key={suggestion}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={value === suggestion}
              className={`autocomplete-option${i === focusedIndex ? " is-focused" : ""}${value === suggestion ? " is-selected" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(suggestion);
              }}
              onMouseEnter={() => setFocusedIndex(i)}
            >
              {highlightMatch(suggestion, value)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AutocompleteField;
