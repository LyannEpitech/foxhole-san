export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}
