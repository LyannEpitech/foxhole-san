import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  applySnapshot,
  captureSnapshot,
  decodeShareHash,
  encodeShareHash,
} from '../lib/snapshot';
import { downloadText } from '../lib/export';
import { useSnapshotStore } from '../store/snapshotStore';

/**
 * A5 — header "Plans" menu: save/load/delete named snapshots, copy a share
 * link (gzip in the URL hash), export/import JSON files. Opening a shared
 * link imports the plan automatically.
 */
export function PlansMenu() {
  const { t } = useTranslation();
  const { saved, save, remove } = useSnapshotStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Import from a shared link once on startup.
  useEffect(() => {
    if (!location.hash.startsWith('#p=')) return;
    void decodeShareHash(location.hash)
      .then((snap) => {
        if (snap) {
          applySnapshot(snap);
          setNotice(t('plans.imported', { name: snap.name }));
          history.replaceState(null, '', location.pathname + location.search);
        }
      })
      .catch(() => setNotice(t('plans.importError')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2500);
  };

  const copyLink = async () => {
    const hash = await encodeShareHash(captureSnapshot(name || t('plans.unnamed')));
    await navigator.clipboard.writeText(location.origin + location.pathname + hash);
    flash(t('plans.linkCopied'));
  };

  const importFile = (file: File) => {
    void file.text().then((text) => {
      try {
        const snap = applySnapshot(JSON.parse(text));
        flash(t('plans.imported', { name: snap.name }));
      } catch {
        flash(t('plans.importError'));
      }
    });
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:border-amber-400"
      >
        🗂 {t('plans.title')}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 z-30 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 space-y-3 text-sm">
          {notice && <p className="text-xs text-emerald-300">{notice}</p>}

          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('plans.namePlaceholder')}
              className="grow min-w-0 bg-slate-950 border border-slate-600 rounded-md px-3 py-1.5 text-slate-100"
            />
            <button
              type="button"
              disabled={!name.trim()}
              onClick={() => { save(captureSnapshot(name.trim())); setName(''); flash(t('plans.saved')); }}
              className="px-3 py-1.5 rounded-md bg-amber-500 text-slate-900 font-semibold disabled:opacity-40"
            >
              💾
            </button>
          </div>

          {saved.length > 0 && (
            <ul className="space-y-1 max-h-56 overflow-y-auto">
              {[...saved].sort((a, b) => b.savedAt - a.savedAt).map((snap) => (
                <li key={snap.name} className="flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-md px-2.5 py-1.5">
                  <span className="grow truncate text-slate-100">{snap.name}</span>
                  <button
                    type="button"
                    onClick={() => { applySnapshot(snap); flash(t('plans.loaded', { name: snap.name })); }}
                    className="text-xs px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-amber-200"
                  >
                    {t('plans.load')}
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadText(`${snap.name}.foxplan.json`, JSON.stringify(snap, null, 1), 'application/json')}
                    className="text-xs px-1.5 rounded text-slate-300 hover:text-slate-100"
                    title={t('plans.exportJson')}
                  >
                    ⬇
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(snap.name)}
                    className="text-red-400 hover:text-red-300"
                    aria-label="delete"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2 border-t border-slate-800 pt-2">
            <button
              type="button"
              onClick={() => void copyLink()}
              className="grow px-2 py-1.5 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-100 text-xs"
            >
              🔗 {t('plans.copyLink')}
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="grow px-2 py-1.5 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-100 text-xs"
            >
              📂 {t('plans.importJson')}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
            />
          </div>
        </div>
      )}
    </div>
  );
}
