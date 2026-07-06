import { useState } from 'react';

interface Props {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

/**
 * Right-side collapsible panel overlaying a fullscreen map. The toggle
 * handle sticks out of the drawer's left edge and slides with it.
 */
export function Drawer({ title, children, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <aside
      className={`absolute top-0 right-0 h-full w-[400px] max-w-[92vw] z-20 flex flex-col
        bg-slate-900/95 backdrop-blur border-l border-slate-700 shadow-2xl
        transition-transform duration-200 ${open ? '' : 'translate-x-full'}`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="absolute -left-8 top-1/2 -translate-y-1/2 w-8 h-20 rounded-l-lg
          bg-slate-900/95 border border-r-0 border-slate-700 text-slate-300
          hover:text-amber-300 flex items-center justify-center"
        title={title}
      >
        <span className="text-lg">{open ? '▸' : '◂'}</span>
      </button>

      <div className="px-4 py-3 border-b border-slate-800">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">{children}</div>
    </aside>
  );
}
