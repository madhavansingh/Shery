import AppIcon from '../AppIcon';

export default function WorkspaceHeader({
  workspace,
  onAddSource,
  onOpenSearch,
  onDeleteWorkspace,
}) {
  if (!workspace) return null;

  return (
    <header className="h-[56px] flex items-center justify-between px-6 border-b border-white/5 bg-[#08090d]/80 backdrop-blur-md select-none shrink-0">
      {/* Left: Workspace Title & Details */}
      <div className="flex items-center gap-3">
        <span className="text-xl">{workspace.emoji || '🧠'}</span>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-slate-100 tracking-tight leading-none">{workspace.name}</h1>
            <span className="text-[10px] font-bold text-slate-400 bg-white/[0.03] border border-white/5 px-2 py-0.5 rounded-full">
              {workspace.sourceCount || 0} {workspace.sourceCount === 1 ? 'source' : 'sources'}
            </span>
          </div>
        </div>
      </div>

      {/* Center: Premium Cmd+K Search trigger */}
      <div className="flex-1 max-w-md mx-6">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 rounded-xl px-3.5 py-1.5 text-xs text-slate-450 hover:text-slate-200 transition duration-150"
        >
          <div className="flex items-center gap-2">
            <AppIcon name="search" size={13} className="text-slate-450" />
            <span>Search grounding sources...</span>
          </div>
          <div className="flex items-center gap-0.5 opacity-60">
            <span className="bg-white/[0.05] px-1 py-0.5 rounded-md border border-white/5 text-[9px] font-mono text-slate-400">⌘</span>
            <span className="bg-white/[0.05] px-1.5 py-0.5 rounded-md border border-white/5 text-[9px] font-mono text-slate-400">K</span>
          </div>
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onAddSource}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-950/20 hover:scale-[1.01] transition duration-150"
        >
          <AppIcon name="upload" size={12} />
          <span>Add Source</span>
        </button>

        <button
          onClick={onDeleteWorkspace}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/[0.02] border border-transparent hover:border-white/5 transition"
          title="Delete Workspace"
        >
          <AppIcon name="trash" size={14} className="text-slate-500 hover:text-slate-300" />
        </button>
      </div>
    </header>
  );
}
