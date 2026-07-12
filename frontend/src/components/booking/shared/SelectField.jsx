import { useState, useRef, useEffect, useCallback, useId } from "react";
import { FaChevronDown, FaCheckCircle } from "react-icons/fa";

/**
 * @component SelectField
 * @description Custom accessible select replacement. Matches the brand's
 * navy+green palette and card design. Emits synthetic onChange events
 * compatible with react-hook-form and custom handlers alike.
 *
 * @param {Object}   props
 * @param {string}   props.id
 * @param {string}   props.name
 * @param {string}   props.value              - Current value
 * @param {Function} props.onChange           - Called with { target: { name, value } }
 * @param {Array}    props.options            - Array of { value, label } objects
 * @param {string}   [props.placeholder]      - Placeholder text when no value
 * @param {boolean}  [props.disabled]
 * @param {boolean}  [props.isValid]          - Show green check icon
 * @param {string}   [props.stateClass]       - Extra class (e.g. "is-valid", "error")
 * @param {string}   [props.aria-invalid]
 * @param {string}   [props.aria-describedby]
 */
const SelectField = ({
  id,
  name,
  value,
  onChange,
  options = [],
  placeholder = "Elegí una opción",
  disabled = false,
  isValid = false,
  stateClass = "",
  required = false,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
  "aria-describedby": ariaDescribedBy,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  /* ── Emit synthetic event ─────────────────────────────────────── */
  const emitChange = useCallback(
    (optValue) => {
      onChange({ target: { name, value: optValue } });
    },
    [name, onChange],
  );

  /* ── Select an option ─────────────────────────────────────────── */
  const handleSelect = useCallback(
    (optValue) => {
      emitChange(optValue);
      setIsOpen(false);
      setFocusedIndex(-1);
      // Return focus to trigger after selection
      setTimeout(() => triggerRef.current?.focus(), 0);
    },
    [emitChange],
  );

  /* ── Toggle open ──────────────────────────────────────────────── */
  const handleTriggerClick = useCallback(() => {
    if (disabled) return;
    setIsOpen((prev) => {
      if (!prev) {
        // When opening, pre-focus selected item
        const idx = options.findIndex((o) => o.value === value);
        setFocusedIndex(idx >= 0 ? idx : 0);
      }
      return !prev;
    });
  }, [disabled, options, value]);

  /* ── Keyboard nav ─────────────────────────────────────────────── */
  const handleKeyDown = useCallback(
    (e) => {
      if (disabled) return;
      switch (e.key) {
        case "Enter":
        case " ":
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            const idx = options.findIndex((o) => o.value === value);
            setFocusedIndex(idx >= 0 ? idx : 0);
          } else if (focusedIndex >= 0) {
            handleSelect(options[focusedIndex].value);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setFocusedIndex(-1);
          triggerRef.current?.focus();
          break;
        case "ArrowDown":
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            setFocusedIndex(0);
          } else {
            setFocusedIndex((prev) =>
              Math.min(prev + 1, options.length - 1),
            );
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (isOpen) {
            setFocusedIndex((prev) => Math.max(prev - 1, 0));
          }
          break;
        case "Tab":
          setIsOpen(false);
          break;
        default:
          break;
      }
    },
    [disabled, isOpen, focusedIndex, options, value, handleSelect],
  );

  /* ── Scroll focused option into view ─────────────────────────── */
  useEffect(() => {
    if (!isOpen || focusedIndex < 0) return;
    const item = listRef.current?.children[focusedIndex];
    item?.scrollIntoView({ block: "nearest" });
  }, [focusedIndex, isOpen]);

  /* ── Close on outside click ───────────────────────────────────── */
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

  return (
    <div
      ref={containerRef}
      className={`custom-select-wrapper${isOpen ? " is-open" : ""}${disabled ? " is-disabled" : ""}${stateClass ? ` ${stateClass}` : ""}`}
    >
      {/* ── Trigger button ── */}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-activedescendant={
          isOpen && focusedIndex >= 0
            ? `${listId}-opt-${focusedIndex}`
            : undefined
        }
        aria-invalid={ariaInvalid}
        aria-required={ariaRequired || required || undefined}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        className={`custom-select-trigger${value ? " has-value" : ""}`}
        onClick={handleTriggerClick}
        onKeyDown={handleKeyDown}
      >
        <span className="custom-select-value">
          {value ? (
            selectedLabel
          ) : (
            <span className="custom-select-placeholder">{placeholder}</span>
          )}
        </span>
        <FaChevronDown className="custom-select-chevron" aria-hidden="true" />
      </button>

      {/* ── Dropdown list ── */}
      {isOpen && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="custom-select-list"
          aria-label={placeholder}
        >
          {options.map((opt, index) => (
            <li
              key={opt.value}
              id={`${listId}-opt-${index}`}
              role="option"
              aria-selected={opt.value === value}
              className={`custom-select-option${opt.value === value ? " is-selected" : ""}${index === focusedIndex ? " is-focused" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur before selection
                handleSelect(opt.value);
              }}
              onMouseEnter={() => setFocusedIndex(index)}
            >
              <span className="custom-select-option-label">{opt.label}</span>
              {opt.value === value && (
                <FaCheckCircle
                  className="custom-select-check"
                  aria-hidden="true"
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {/* ── Valid icon (outside, only when closed) ── */}
      {isValid && !isOpen && (
        <FaCheckCircle
          className="valid-icon custom-select-valid-icon"
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default SelectField;
