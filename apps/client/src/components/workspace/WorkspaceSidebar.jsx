import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AppIcon from '../AppIcon';

export default function WorkspaceSidebar({
  workspaces = [],
  activeWorkspaceId,
  onSelectWorkspace,
  onNewWorkspace,
  activeTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
}) {
  const currentWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const sourceLimit = 20;
  const currentSources = currentWorkspace?.sourceCount || 0;
  const sourcePercentage = Math.min(Math.round((currentSources / sourceLimit) * 100), 100);

  return (
    <motion.aside
      animate={{ width: isCollapsed ? 64 : 240 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="relative flex flex-col h-full border-r border-white/5 bg-[#06070a] select-none shrink-0 z-20"
    >
      {/* Sidebar Collapse Toggle Handle */}
      <button
        onClick={onToggleCollapse}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#0b0c10] border border-white/10 flex items-center justify-center text-slate-400 hover:text-slate-200 shadow-md hover:scale-110 cursor-pointer z-30 transition-all duration-200"
        title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
      >
        <AppIcon
          name="chevronLeft"
          size={12}
          className={`transform transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Brand & Workspace Branding */}
      <div className="p-4 flex items-center justify-between border-b border-white/5 h-16">
        <Link to="/" className="flex items-center gap-2.5 group overflow-hidden">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg group-hover:scale-105 transition-transform duration-200 shrink-0">
            <AppIcon name="brain" size={16} />
          </div>
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="text-sm font-bold tracking-tight text-slate-100 group-hover:text-indigo-400 transition-colors duration-200"
            >
              SheryAI
            </motion.span>
          )}
        </Link>
        {!isCollapsed && (
          <span className="text-[9px] uppercase font-bold tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/15 px-2 py-0.5 rounded-md font-mono">
            OS
          </span>
        )}
      </div>

      {/* Navigation Options (only visible if a workspace is loaded) */}
      {activeWorkspaceId && (
        <div className="px-3 py-4 space-y-1 border-b border-white/5">
          {[
            { id: 'chat', label: 'Grounding Playground', icon: 'message' },
            { id: 'studio', label: 'Studio Assets', icon: 'sparkles' },
            { id: 'dashboard', label: 'Learning Intelligence', icon: 'graduation' },
          ].map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`relative w-full flex items-center ${
                  isCollapsed ? 'justify-center' : 'justify-start'
                } gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl transition duration-200 cursor-pointer ${
                  isActive ? 'text-indigo-300' : 'text-slate-400 hover:text-slate-200'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabPill"
                    className="absolute inset-0 bg-indigo-500/10 border border-indigo-500/15 rounded-xl -z-10"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <AppIcon name={item.icon} size={15} className={isActive ? 'text-indigo-400' : ''} />
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="truncate"
                  >
                    {item.label}
                  </motion.span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Workspaces Scrollable List */}
      <div className="flex-1 flex flex-col min-h-0 pt-4">
        <div className={`px-4 flex items-center justify-between mb-2 ${isCollapsed ? 'justify-center' : ''}`}>
          {!isCollapsed && (
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500">
              Knowledge Spaces
            </span>
          )}
          <button
            onClick={onNewWorkspace}
            className="text-slate-500 hover:text-slate-300 transition-all hover:scale-105 p-1 rounded-md hover:bg-white/5 cursor-pointer"
            title="Create Space"
          >
            <AppIcon name={isCollapsed ? 'wrench' : 'wrench'} size={12} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-1 scrollbar-thin">
          {workspaces.map((ws) => {
            const isActive = activeWorkspaceId === ws.id;
            return (
              <button
                key={ws.id}
                onClick={() => onSelectWorkspace(ws.id)}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center' : 'justify-between'
                } px-3 py-2.5 rounded-xl text-left transition duration-200 group cursor-pointer ${
                  isActive
                    ? 'bg-white/[0.04] text-slate-100 border border-white/5 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.015] border border-transparent'
                }`}
                title={ws.name}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base shrink-0 select-none">{ws.emoji || '🧠'}</span>
                  {!isCollapsed && (
                    <span className="text-xs font-semibold truncate text-slate-300 group-hover:text-slate-100">
                      {ws.name}
                    </span>
                  )}
                </div>
                {!isCollapsed && (
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md transition ${
                      isActive
                        ? 'text-indigo-400 bg-indigo-500/10 border border-indigo-500/15'
                        : 'text-slate-500 bg-white/[0.02] border border-white/5 opacity-60 group-hover:opacity-100'
                    }`}
                  >
                    {ws.sourceCount || 0}
                  </span>
                )}
              </button>
            );
          })}

          {workspaces.length === 0 && !isCollapsed && (
            <div className="text-center py-6 px-4">
              <span className="text-[10px] text-slate-500 block mb-3">No workspaces yet</span>
              <button
                onClick={onNewWorkspace}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/15 rounded-lg hover:bg-indigo-500/20 transition cursor-pointer"
              >
                <AppIcon name="wrench" size={10} />
                Create New
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Storage and Free Tier Progress */}
      {!isCollapsed && activeWorkspaceId && currentWorkspace && (
        <div className="p-4 border-t border-white/5 bg-black/10 mx-2 mb-2 rounded-2xl border border-white/5">
          <div className="flex items-center justify-between text-[10px] mb-1.5">
            <span className="font-semibold text-slate-400">Space Limit</span>
            <span className="font-bold text-slate-200">
              {currentSources} / {sourceLimit} files
            </span>
          </div>
          <div className="w-full bg-white/[0.04] rounded-full h-1 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                sourcePercentage > 85 ? 'bg-rose-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${sourcePercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Sidebar Footer / User section */}
      <div className="p-3 border-t border-white/5 bg-[#040406]/35 flex flex-col gap-2">
        <Link
          to="/"
          className={`flex items-center ${
            isCollapsed ? 'justify-center' : 'justify-start'
          } gap-2 px-2.5 py-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/[0.02] transition duration-200`}
          title="Exit Workspace"
        >
          <AppIcon name="chevronLeft" size={14} />
          {!isCollapsed && <span className="text-xs font-semibold">Exit Workspace</span>}
        </Link>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-2.5 py-1.5`}>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold text-slate-300 truncate">Workspace User</span>
              <span className="text-[9px] text-slate-500 truncate">Free Tier</span>
            </div>
          )}
          <div className="w-7 h-7 rounded-xl bg-indigo-950/40 border border-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-300 select-none shadow-md shrink-0">
            US
          </div>
        </div>
      </div>
    </motion.aside>
  );
}
