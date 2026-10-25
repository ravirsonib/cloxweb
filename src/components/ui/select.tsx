import {
  Children,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { FieldShell } from './field';

type OptionData = {
  value: string;
  label: string;
  disabled: boolean;
};

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
};

/** Flatten option children (string | number | arrays / fragments) into display text. */
function childrenToLabel(children: ReactNode, fallback: string): string {
  if (children == null || children === false || children === true) return fallback;
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children)) {
    const joined = children
      .map((part) => childrenToLabel(part, ''))
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    return joined || fallback;
  }
  if (isValidElement(children)) {
    const nested = (children.props as { children?: ReactNode }).children;
    return childrenToLabel(nested, fallback);
  }
  return fallback;
}

function parseOptions(children: ReactNode): OptionData[] {
  const options: OptionData[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type !== 'option') return;
    const props = child.props as {
      value?: string | number;
      disabled?: boolean;
      children?: ReactNode;
    };
    const value = props.value == null ? '' : String(props.value);
    const label = childrenToLabel(props.children, value);
    options.push({
      value,
      label,
      disabled: Boolean(props.disabled),
    });
  });
  return options;
}

function labelForValue(options: OptionData[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    hint,
    error,
    className,
    id,
    required,
    children,
    disabled,
    name,
    value,
    defaultValue,
    onChange,
    onBlur,
    ...rest
  },
  forwardedRef,
) {
  const reactId = useId();
  const fieldId = id ?? (typeof name === 'string' ? name : undefined) ?? `select-${reactId}`;
  const listboxId = `${fieldId}-listbox`;

  const options = useMemo(() => parseOptions(children), [children]);
  const isControlled = value !== undefined;

  const hiddenRef = useRef<HTMLSelectElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const [uncontrolledValue, setUncontrolledValue] = useState(() => {
    if (defaultValue != null) return String(defaultValue);
    if (options.some((option) => option.value === '')) return '';
    return String(options[0]?.value ?? '');
  });
  const [activeIndex, setActiveIndex] = useState(0);

  useImperativeHandle(forwardedRef, () => hiddenRef.current as HTMLSelectElement);

  const currentValue = isControlled ? String(value ?? '') : uncontrolledValue;
  const displayLabel = labelForValue(options, currentValue) || '—';

  const enabledIndexes = useMemo(
    () => options.map((option, index) => (option.disabled ? -1 : index)).filter((index) => index >= 0),
    [options],
  );

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const commit = useCallback(
    (next: string) => {
      if (hiddenRef.current) {
        hiddenRef.current.value = next;
      }
      if (!isControlled) {
        setUncontrolledValue(next);
      }
      if (onChange) {
        const target = hiddenRef.current ?? ({ value: next, name: name ?? '' } as HTMLSelectElement);
        onChange({
          target,
          currentTarget: target,
        } as ChangeEvent<HTMLSelectElement>);
      }
      setOpen(false);
      triggerRef.current?.focus();
    },
    [isControlled, name, onChange],
  );

  const updatePopoverPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const maxHeight = 256;
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < Math.min(maxHeight, 160) && spaceAbove > spaceBelow;
    const width = Math.max(rect.width, 160);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);

    if (openUp) {
      setPopoverStyle({
        position: 'fixed',
        left,
        width,
        bottom: window.innerHeight - rect.top + gap,
        top: 'auto',
        maxHeight: Math.min(maxHeight, Math.max(120, spaceAbove)),
      });
    } else {
      setPopoverStyle({
        position: 'fixed',
        left,
        width,
        top: rect.bottom + gap,
        bottom: 'auto',
        maxHeight: Math.min(maxHeight, Math.max(120, spaceBelow)),
      });
    }
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePopoverPosition();
    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);
    return () => {
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
    };
  }, [open, updatePopoverPosition, options.length]);

  useEffect(() => {
    if (!open) return;

    const selectedIndex = Math.max(
      0,
      options.findIndex((option) => option.value === currentValue && !option.disabled),
    );
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : (enabledIndexes[0] ?? 0));

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close, currentValue, enabledIndexes, options]);

  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  function moveActive(delta: number) {
    if (enabledIndexes.length === 0) return;
    const currentPos = enabledIndexes.indexOf(activeIndex);
    const start = currentPos >= 0 ? currentPos : 0;
    const nextPos = (start + delta + enabledIndexes.length) % enabledIndexes.length;
    setActiveIndex(enabledIndexes[nextPos]!);
  }

  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (event.key === 'ArrowDown') moveActive(1);
      if (event.key === 'ArrowUp') moveActive(-1);
      if (event.key === 'Enter' || event.key === ' ') {
        const option = options[activeIndex];
        if (option && !option.disabled) commit(option.value);
      }
    }
  }

  function onListKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      if (enabledIndexes[0] != null) setActiveIndex(enabledIndexes[0]);
    } else if (event.key === 'End') {
      event.preventDefault();
      const last = enabledIndexes[enabledIndexes.length - 1];
      if (last != null) setActiveIndex(last);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = options[activeIndex];
      if (option && !option.disabled) commit(option.value);
    }
  }

  function handleBlur(event: FocusEvent<HTMLButtonElement>) {
    onBlur?.({
      target: hiddenRef.current ?? event.target,
      currentTarget: hiddenRef.current ?? event.currentTarget,
    } as FocusEvent<HTMLSelectElement>);
  }

  const listbox =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={popoverRef}
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            aria-activedescendant={`${fieldId}-opt-${activeIndex}`}
            className="clox-select-popover"
            style={popoverStyle}
            onKeyDown={onListKeyDown}
          >
            {options.map((option, index) => {
              const selected = option.value === currentValue;
              const active = index === activeIndex;
              return (
                <button
                  key={`${option.value}-${index}`}
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  id={`${fieldId}-opt-${index}`}
                  type="button"
                  role="option"
                  disabled={option.disabled}
                  aria-selected={selected}
                  className={cn(
                    'clox-select-option',
                    selected && 'clox-select-option-selected',
                    active && 'clox-select-option-active',
                  )}
                  onMouseEnter={() => {
                    if (!option.disabled) setActiveIndex(index);
                  }}
                  onClick={() => {
                    if (!option.disabled) commit(option.value);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate text-left">{option.label}</span>
                  {selected ? <Check size={14} aria-hidden className="clox-select-check" /> : null}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={fieldId}
      className={className}
    >
      <div ref={rootRef} className="relative min-w-0 w-full">
        <select
          {...rest}
          ref={hiddenRef}
          id={`${fieldId}-native`}
          name={name}
          required={required}
          disabled={disabled}
          value={isControlled ? currentValue : undefined}
          defaultValue={isControlled ? undefined : uncontrolledValue}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          onChange={onChange}
        >
          {children}
        </select>

        <button
          ref={triggerRef}
          id={fieldId}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          className={cn('clox-field-control clox-select-trigger', open && 'clox-select-trigger-open')}
          onClick={() => {
            if (!disabled) setOpen((prev) => !prev);
          }}
          onKeyDown={onTriggerKeyDown}
          onBlur={handleBlur}
        >
          <span className="min-w-0 flex-1 truncate text-left">{displayLabel}</span>
          <ChevronDown
            className={cn('clox-select-chevron', open && 'clox-select-chevron-open')}
            size={16}
            aria-hidden
          />
        </button>

        {listbox}
      </div>
    </FieldShell>
  );
});
