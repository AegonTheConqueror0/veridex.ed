import React from 'react';

export type WorkspaceTab = 'scanner' | 'lab' | 'archive' | 'methodology';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onNewScan: () => void;
}

const NAV_ITEMS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'scanner', label: 'Scanner' },
  { id: 'lab', label: 'Forensic Lab' },
  { id: 'archive', label: 'Index Archive' },
  { id: 'methodology', label: 'Methodology' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  onNewScan,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#06090F]/70 backdrop-blur-2xl">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-8 px-4 sm:px-6">
        <button
          type="button"
          onClick={() => onSelectTab('scanner')}
          className="font-display text-base font-semibold tracking-tight text-slate-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded"
        >
          Veridex by Ed
        </button>

        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-7"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-1.5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded ${
                  isActive
                    ? 'text-cyan-300'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[15px] h-[2px] rounded-full bg-cyan-400/90"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onNewScan}
            className="min-h-[38px] rounded-xl border border-cyan-300/35 bg-cyan-400/90 px-4 py-1.5 text-sm font-semibold text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] transition-all hover:bg-cyan-300 active:scale-[0.98] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            New Scan
          </button>
        </div>
      </div>
    </header>
  );
};
