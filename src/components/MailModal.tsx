import React from 'react';
import { sound } from '../services/sound';
import { Mail, Gift, ChevronRight, X, Sparkles, CheckCircle2 } from 'lucide-react';

interface Props {
  hasClaimedBeginnerPack: boolean;
  onOpenBeginnerPack: () => void;
  onClose: () => void;
}

export const MailModal: React.FC<Props> = ({
  hasClaimedBeginnerPack,
  onOpenBeginnerPack,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl text-slate-100 flex flex-col justify-between max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-rose-400" />
            <h3 className="text-xl font-bold font-game text-white">Mailbox</h3>
            {!hasClaimedBeginnerPack && (
              <span className="px-2 py-0.5 rounded-full bg-rose-500 text-[10px] font-extrabold text-white">
                1 NEW
              </span>
            )}
          </div>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mail List */}
        <div className="space-y-3 overflow-y-auto pr-1">
          {/* Mail 1: Beginner Pack Gift */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              !hasClaimedBeginnerPack
                ? 'bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border-purple-500/60 shadow-lg shadow-purple-500/10'
                : 'bg-slate-950/60 border-slate-800 opacity-70'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shrink-0">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-white font-game">
                      Welcome Gift: 2x Beginner Booster Packs
                    </h4>
                    {!hasClaimedBeginnerPack && (
                      <span className="text-[10px] px-1.5 py-0.2 bg-amber-400 text-slate-950 font-extrabold rounded">
                        2 PACKS
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Dear Adventurer! Congratulations on arriving in Starmon Arena. Here are your 2 exclusive Starter Booster Packs containing Gold, Upgrade Cards, and your first 2 Starter Starmons!
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-purple-500/20 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Attached: 2x Legendary Starter Packs</span>
              {!hasClaimedBeginnerPack ? (
                <button
                  onClick={() => {
                    sound.playClick();
                    onOpenBeginnerPack();
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-bold font-game text-xs rounded-xl shadow-md shadow-amber-400/20 flex items-center gap-1.5 transition-transform active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-950" />
                  OPEN PACK
                  <ChevronRight className="w-3.5 h-3.5 text-amber-950" />
                </button>
              ) : (
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Claimed
                </span>
              )}
            </div>
          </div>

          {/* Mail 2: Global Season Notice */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 text-lg">
                📢
              </div>
              <div>
                <h4 className="font-bold text-sm text-white font-game">Season 1: Elemental Dawn</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  The match-3 battle ranked ladder is now active! Defeat elemental masters, master grammar & vocabulary quizzes, and climb to Champion rank.
                </p>
                <span className="text-[10px] text-slate-500 mt-2 block">System Notice · 2026 Season</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-800 text-right">
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl text-slate-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
