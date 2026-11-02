import { useEffect, useRef, useState, type ReactNode } from 'react';

interface DropdownProps {
  button: (state: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'start' | 'end';
}

export function Dropdown({ button, children, align = 'end' }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="dropdown" ref={ref}>
      {button({ open, toggle: () => setOpen((value) => !value) })}
      {open && (
        <div className={`menu menu-${align}`} role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

interface MenuItemProps {
  icon?: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export function MenuItem({ icon, label, onClick, danger, disabled }: MenuItemProps) {
  return (
    <button
      type="button"
      className={`menu-item${danger ? ' danger' : ''}`}
      onClick={onClick}
      disabled={disabled}
      role="menuitem"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function MenuSeparator() {
  return <div className="menu-sep" role="separator" />;
}
