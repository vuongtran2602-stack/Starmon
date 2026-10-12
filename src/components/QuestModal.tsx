import React, { useState, useRef } from 'react';
import { QuestCategory, QuestItem } from '../types';
import { sound } from '../services/sound';
import { X, CheckCircle2, Sparkles, Award, Calendar, Clock, Crown, Gift, ArrowUp, ArrowDown } from 'lucide-react';
import questIconImg from '../assets/icons/quest_icon.png';

interface Props {
  quests: QuestItem[];
  onClose: () => void;
  onClaimReward: (quest: QuestItem) => void;
}

export const QuestModal: React.FC<Props> = ({ quests, onClose, onClaimReward }) => {
  const [activeTab, setActiveTab] = useState<QuestCategory>('daily');
  const questScrollRef = useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    sound.playClick();
    if (questScrollRef.current) {
      questScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToBottom = () => {
    sound.playClick();
    if (questScrollRef.current) {
      questScrollRef.current.scrollTo({ top: questScrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  const filteredQuests = quests.filter(q => q.category === activeTab);

  const getUnclaimedCount = (cat: QuestCategory) => {
    return quests.filter(q => q.category === cat && !q.claimed && q.currentProgress >= q.maxProgress).length;
  };

  const tabs: { id: QuestCategory; label: string; icon: React.ReactNode }[] = [
    { id: 'daily', label: 'Daily Quests', icon: <Calendar className="w-4 h-4" /> },
    { id: 'weekly', label: 'Weekly Quests', icon: <Clock className="w-4 h-4" /> },
    { id: 'monthly', label: 'Monthly Quests', icon: <Award className="w-4 h-4" /> },
    { id: 'legend', label: 'Legend Quests', icon: <Crown className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-amber-400/90 rounded-3xl p-5 md:p-6 max-w-2xl w-full shadow-2xl text-slate-100 flex flex-col justify-between max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 p-0.5 shadow-lg flex items-center justify-center">
              <img
                src={questIconImg}
                alt="Quest System"
                className="w-10 h-10 object-contain drop-shadow"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://www.dropbox.com/scl/fi/4i0fsryrmfgftnavhdmmq/Quest-Icon.png?rlkey=le5y1mtg979aiyotch95w33ln&st=xhi47owr&raw=1';
                }}
              />
            </div>
            <div>
              <h3 className="text-xl font-black font-game text-white flex items-center gap-2">
                Quest Codex & Missions
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 font-mono">
                  4 Categories
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Complete IELTS speaking challenges, battle matches, and growth milestones to earn rewards!
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 Sub-sections Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 mb-3 shrink-0">
          {tabs.map(tab => {
            const unclaimed = getUnclaimedCount(tab.id);
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  sound.playClick();
                  setActiveTab(tab.id);
                }}
                className={`py-2 px-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 relative cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {unclaimed > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black font-mono animate-bounce ${
                    isActive ? 'bg-rose-600 text-white' : 'bg-rose-500 text-white'
                  }`}>
                    {unclaimed}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Quest Items List with Scroll Up & Down Controls */}
        <div className="relative flex-1 max-h-[56vh] flex flex-col">
          <div className="absolute -top-1.5 right-2 z-20 flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 rounded-full p-1 shadow-lg backdrop-blur-sm">
            <button
              onClick={scrollToTop}
              className="p-1 rounded-full bg-slate-800 hover:bg-amber-500 text-slate-300 hover:text-slate-950 transition-colors cursor-pointer"
              title="Scroll Up (Cuộn lên đầu)"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={scrollToBottom}
              className="p-1 rounded-full bg-slate-800 hover:bg-amber-500 text-slate-300 hover:text-slate-950 transition-colors cursor-pointer"
              title="Scroll Down (Cuộn xuống cuối)"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>

          <div ref={questScrollRef} className="flex-1 overflow-y-auto space-y-2.5 pr-1 scroll-smooth pt-5">
            {filteredQuests.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No quests currently available in this category.
            </div>
          ) : (
            filteredQuests.map(quest => {
              const isCompleted = quest.currentProgress >= quest.maxProgress;
              const canClaim = isCompleted && !quest.claimed;
              const percent = Math.min(100, Math.round((quest.currentProgress / quest.maxProgress) * 100));

              return (
                <div
                  key={quest.id}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    quest.claimed
                      ? 'bg-slate-950/60 border-slate-800/80 opacity-70'
                      : canClaim
                      ? 'bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border-amber-400/80 shadow-lg shadow-amber-500/10'
                      : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-xl shrink-0 shadow-inner">
                      {quest.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-black font-game text-sm text-white truncate">
                          {quest.title}
                        </h4>
                        {quest.claimed && (
                          <span className="px-2 py-0.2 rounded-full bg-slate-800 text-slate-400 text-[10px] font-bold">
                            Claimed
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                        {quest.description}
                      </p>

                      {/* Progress Bar */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-900 rounded-full border border-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isCompleted
                                ? 'bg-gradient-to-r from-emerald-400 to-teal-400'
                                : 'bg-gradient-to-r from-amber-400 to-yellow-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono font-bold text-slate-400 shrink-0">
                          {quest.currentProgress} / {quest.maxProgress}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Reward & Action Button */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Reward
                      </span>
                      <span className="text-xs font-black font-game text-amber-300 flex items-center gap-1 sm:justify-end">
                        <Gift className="w-3.5 h-3.5 text-amber-400" />
                        {quest.rewardLabel}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        if (canClaim) {
                          sound.playRewardFanfare();
                          onClaimReward(quest);
                        }
                      }}
                      disabled={!canClaim}
                      className={`px-4 py-2 rounded-xl text-xs font-black font-game transition-all flex items-center gap-1.5 ${
                        quest.claimed
                          ? 'bg-slate-800/80 text-slate-500 cursor-not-allowed'
                          : canClaim
                          ? 'bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 shadow-md shadow-amber-500/30 cursor-pointer active:scale-95 animate-pulse'
                          : 'bg-slate-800 text-slate-400 cursor-not-allowed opacity-60'
                      }`}
                    >
                      {quest.claimed ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                          Claimed
                        </>
                      ) : canClaim ? (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                          CLAIM REWARD
                        </>
                      ) : (
                        `${percent}%`
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-3 mt-2 shrink-0">
          <span className="text-[11px] text-slate-400">
            Quests reset daily at 00:00 UTC · Legend quests do not expire
          </span>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
