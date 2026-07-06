import { useTranslation } from 'react-i18next';
import type { RequirementNode } from '../engine/resolver';
import { useLocalized } from '../i18n';
import { refName } from '../lib/refs';

function TreeNode({ node, depth }: { node: RequirementNode; depth: number }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const overproduced = node.produced !== undefined && node.produced > node.qty;

  return (
    <li>
      <div
        className="flex flex-wrap items-baseline gap-x-2 py-1"
        style={{ paddingLeft: `${depth * 1.25}rem` }}
      >
        <span className={node.children.length === 0 ? 'text-emerald-300' : 'text-slate-100'}>
          {depth > 0 && <span className="text-slate-500 mr-1">└</span>}
          {localized(refName(node.refId))}
        </span>
        <span className="font-mono text-amber-300">× {node.qty}</span>
        {node.batches !== undefined && (
          <span className="text-xs text-slate-400">
            {t('tree.batches', { count: node.batches })}
            {overproduced &&
              ` — ${t('tree.produced', { produced: node.produced, qty: node.qty })}`}
          </span>
        )}
      </div>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child, i) => (
            <TreeNode key={`${child.refId}-${i}`} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function RequirementTree({ root }: { root: RequirementNode }) {
  return (
    <ul className="text-sm">
      <TreeNode node={root} depth={0} />
    </ul>
  );
}
