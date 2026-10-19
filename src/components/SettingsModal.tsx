import React, { useState, useEffect, useRef } from 'react';
import { sound } from '../services/sound';
import {
  Volume2,
  VolumeX,
  Music,
  Shield,
  RotateCcw,
  X,
  Sliders,
  BookOpen,
  User,
  LogIn,
  KeyRound,
  Download,
  Upload,
  ShieldCheck,
  Gift,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Smartphone,
  SlidersHorizontal,
  Headphones,
  GraduationCap,
  Monitor,
  LayoutGrid,
  ArrowLeft
} from 'lucide-react';

import { QuizQuestionMode, SpeakingLogEntry } from '../types';

interface Props {
  soundEnabled: boolean;
  musicEnabled: boolean;
  volume: number;
  showSpeakingHints: boolean;
  questionMode?: QuizQuestionMode;
  playerName?: string;
  speakingLog?: SpeakingLogEntry[];
  unitTestExpiry?: number;
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onChangeVolume: (vol: number) => void;
  onToggleSpeakingHints: () => void;
  onChangeQuestionMode?: (mode: QuizQuestionMode) => void;
  onOpenAuthTab: (tab: 'profile' | 'auth' | 'backup' | 'restore' | 'password') => void;
  onResetData: () => void;
  onOpenTutorial: () => void;
  onRedeemCode?: (code: string) => { success: boolean; message: string };
  onClose: () => void;
}

type SettingsSection = 'all' | 'account' | 'speaking_log' | 'audio' | 'edtech' | 'redeem' | 'display' | 'reset';

export const SettingsModal: React.FC<Props> = ({
  soundEnabled,
  musicEnabled,
  volume,
  showSpeakingHints,
  questionMode = 'random',
  playerName,
  speakingLog = [],
  unitTestExpiry,
  onToggleSound,
  onToggleMusic,
  onChangeVolume,
  onToggleSpeakingHints,
  onChangeQuestionMode,
  onOpenAuthTab,
  onResetData,
  onOpenTutorial,
  onRedeemCode,
  onClose,
}) => {
  const [selectedSection, setSelectedSection] = useState<SettingsSection>('all');
  const [redeemInput, setRedeemInput] = useState('');
  const [redeemFeedback, setRedeemFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [aiBgmPrompt, setAiBgmPrompt] = useState('Epic Fantasy RPG Battle with Orchestral Brass and Driving Beats');
  const [isGeneratingBgm, setIsGeneratingBgm] = useState(false);
  const [bgmMessage, setBgmMessage] = useState<{ success: boolean; text: string } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Close when clicking Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const isUnitTestActive = !!(unitTestExpiry && unitTestExpiry > Date.now());
  const remainingDays = isUnitTestActive ? Math.ceil((unitTestExpiry - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

  const handleRedeem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!redeemInput.trim()) return;
    if (onRedeemCode) {
      const res = onRedeemCode(redeemInput.trim());
      setRedeemFeedback(res);
      if (res.success) {
        sound.playRewardFanfare();
        setRedeemInput('');
      } else {
        sound.playWrong();
      }
    }
  };

  const downloadSpeakingLog = (entry: SpeakingLogEntry) => {
    const criteria = Object.entries(entry.criteria)
      .map(([name, result]) => `${name}: Band ${result?.band ?? '-'} — ${result?.feedback ?? ''}`)
      .join('\n');
    const grammar = entry.grammarErrors.map((error, index) =>
      `${index + 1}. ${error.sentence}\n   Lỗi: ${error.error}\n   Sửa: ${error.correction}\n   Giải thích: ${error.explanation}`
    ).join('\n');
    const pronunciation = entry.pronunciationErrors.map((error, index) =>
      `${index + 1}. ${error.word} ${error.phonetic}\n   Vấn đề: ${error.issue}\n   Hướng dẫn: ${error.guide}`
    ).join('\n');
    const content = [
      `Speaking Log — ${new Date(entry.createdAt).toLocaleString()}`,
      `Câu hỏi: ${entry.question}`,
      `Band tổng: ${entry.overallBand}`,
      `\nBài nói:\n${entry.transcript}`,
      `\nNhận xét: ${entry.feedbackVi?.summary || entry.summary}`,
      `\nĐiểm thành phần:\n${criteria}`,
      `\nFluency: ${entry.fluencyDetail?.feedback || ''}`,
      `\nLỗi ngữ pháp:\n${grammar || 'Không ghi nhận'}`,
      `\nPhát âm:\n${pronunciation || 'Không ghi nhận'}`,
      `\nĐiểm mạnh:\n${entry.strengths.join('\n') || '—'}`,
      `\nCần cải thiện:\n${entry.improvements.join('\n') || '—'}`,
      `\nGợi ý: ${entry.feedbackVi?.suggestion || ''}`,
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `speaking-log-${new Date(entry.createdAt).toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadAllSpeakingLogs = () => {
    const blob = new Blob([JSON.stringify(speakingLog, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'starmon-speaking-log.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleSelectSection = (sec: SettingsSection) => {
    sound.playClick();
    setSelectedSection(sec);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Small phone-style category items
  const phoneSections = [
    {
      id: 'all' as SettingsSection,
      label: 'All Settings',
      shortLabel: 'All',
      icon: <LayoutGrid className="w-3.5 h-3.5" />,
      badge: null,
      color: 'text-slate-300 bg-slate-800 border-slate-700',
    },
    {
      id: 'account' as SettingsSection,
      label: 'Account & Sync',
      shortLabel: 'Account',
      icon: <User className="w-3.5 h-3.5" />,
      badge: playerName || 'Profile',
      color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
    },
    {
      id: 'speaking_log' as SettingsSection,
      label: 'Speaking Log',
      shortLabel: 'Speaking Log',
      icon: <BookOpen className="w-3.5 h-3.5" />,
      badge: String(speakingLog.length),
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    },
    {
      id: 'audio' as SettingsSection,
      label: 'Audio & Sound',
      shortLabel: 'Audio',
      icon: <Headphones className="w-3.5 h-3.5" />,
      badge: `${Math.round(volume * 100)}%`,
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    },
    {
      id: 'edtech' as SettingsSection,
      label: 'Học Tập & Hướng Dẫn',
      shortLabel: 'Học Tập',
      icon: <GraduationCap className="w-3.5 h-3.5" />,
      badge: questionMode === 'part3_forecast_2026'
        ? 'Part 3 Forecast 2026'
        : questionMode === 'part1_preference'
          ? 'Part 1 Preference'
          : 'Random',
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    },
    {
      id: 'redeem' as SettingsSection,
      label: 'Redeem Gift Code',
      shortLabel: 'Redeem',
      icon: <Gift className="w-3.5 h-3.5" />,
      badge: isUnitTestActive ? 'UnitTest Active' : 'Code',
      color: 'text-amber-400 bg-amber-500/10 border-amber-400/30',
    },
    {
      id: 'display' as SettingsSection,
      label: 'Display & 60 FPS',
      shortLabel: 'Display',
      icon: <Monitor className="w-3.5 h-3.5" />,
      badge: '60 FPS',
      color: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
    },
    {
      id: 'reset' as SettingsSection,
      label: 'Reset & Backup',
      shortLabel: 'Reset',
      icon: <RotateCcw className="w-3.5 h-3.5" />,
      badge: null,
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200 select-none cursor-pointer"
      title="Click outside this box to close settings"
    >
      {/* Main Settings Modal Box - stops propagation so clicking inside will NOT close */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="cursor-default bg-slate-900 border-2 border-slate-700/80 rounded-3xl max-w-lg w-full max-h-[88vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden my-auto relative"
      >
        {/* Header (Phone-style top navigation bar) */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-2.5">
            {selectedSection !== 'all' ? (
              <button
                onClick={() => handleSelectSection('all')}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                title="Back to All Settings"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>All</span>
              </button>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                <Smartphone className="w-4 h-4" />
              </div>
            )}
            <div>
              <h3 className="text-base md:text-lg font-black font-game text-white tracking-wide flex items-center gap-2">
                <span>Settings</span>
                {selectedSection !== 'all' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-slate-700 font-mono">
                    {phoneSections.find(s => s.id === selectedSection)?.label}
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-slate-400">
                Tap small phone sections below or scroll to adjust preferences
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Close Settings (or click outside box)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Small phone-style section buttons to click on */}
        <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800/80 shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3 h-3 text-amber-400" />
              <span>Tap a Section:</span>
            </span>
            {selectedSection !== 'all' && (
              <button
                onClick={() => handleSelectSection('all')}
                className="text-[10px] text-amber-400 hover:underline font-bold cursor-pointer"
              >
                Show All Sections
              </button>
            )}
          </div>

          {/* Horizontal scrollable phone section pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {phoneSections.map(sec => {
              const isSelected = selectedSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => handleSelectSection(sec.id)}
                  className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md shadow-amber-500/20 scale-102 font-black'
                      : `${sec.color} hover:bg-slate-800/80`
                  }`}
                >
                  {sec.icon}
                  <span>{sec.shortLabel}</span>
                  {sec.badge && (
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded-full font-mono ${
                        isSelected ? 'bg-slate-950/30 text-slate-900' : 'bg-slate-900 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {sec.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Body: Phone-style Settings Inset Sections */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900"
        >
          {/* ======================================================== */}
          {/* PHONE SECTION 1: ACCOUNT & CLOUD SYNC */}
          {/* ======================================================== */}
          {(selectedSection === 'all' || selectedSection === 'account') && (
            <div className="animate-in fade-in duration-200">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Trainer Profile & Cloud Sync</span>
                </div>
                <span className="text-[10px] text-indigo-400 font-mono">Account</span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800/60 shadow-sm">
                {/* Profile Overview Row */}
                <div className="p-3 flex items-center justify-between bg-indigo-950/20">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-sm shadow">
                      {(playerName || 'T').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white font-game block">
                        {playerName || 'Guest Adventurer'}
                      </span>
                      <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Active Local Profile
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      onOpenAuthTab('auth');
                    }}
                    className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1 shadow-sm active:scale-95"
                  >
                    <LogIn className="w-3 h-3" />
                    Switch User
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    handleSelectSection('speaking_log');
                  }}
                  className="w-full p-3 flex items-center justify-between hover:bg-slate-900/90 transition-colors text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Speaking Log</span>
                      <span className="text-[10px] text-slate-400 block">Xem và tải {speakingLog.length} bài nói cùng nhận xét chi tiết</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                </button>

                {/* Setting Row: Manage Account */}
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    onOpenAuthTab('auth');
                  }}
                  className="w-full p-3 flex items-center justify-between hover:bg-slate-900/90 active:bg-slate-850 transition-colors text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Log In / Sign Up</span>
                      <span className="text-[10px] text-slate-400 block">Switch accounts or create trainer credentials</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                </button>

                {/* Setting Row: Password & PIN */}
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    onOpenAuthTab('password');
                  }}
                  className="w-full p-3 flex items-center justify-between hover:bg-slate-900/90 active:bg-slate-850 transition-colors text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Security PIN & Password</span>
                      <span className="text-[10px] text-slate-400 block">Update account access PIN passcode</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                </button>

                {/* Setting Row: Backup .json */}
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    onOpenAuthTab('backup');
                  }}
                  className="w-full p-3 flex items-center justify-between hover:bg-slate-900/90 active:bg-slate-850 transition-colors text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                      <Download className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Export Save File (.json)</span>
                      <span className="text-[10px] text-slate-400 block">Download encrypted offline backup file</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                </button>

                {/* Setting Row: Restore .json */}
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    onOpenAuthTab('restore');
                  }}
                  className="w-full p-3 flex items-center justify-between hover:bg-slate-900/90 active:bg-slate-850 transition-colors text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Import Save File (.json)</span>
                      <span className="text-[10px] text-slate-400 block">Restore progress from previously saved file</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
                </button>
              </div>
            </div>
          )}

          {selectedSection === 'speaking_log' && (
            <section className="space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-black text-amber-300">Speaking Log</h4>
                  <p className="text-[10px] text-slate-400">Bài nói và kết quả được lưu trên hồ sơ người chơi này.</p>
                </div>
                <button
                  type="button"
                  disabled={speakingLog.length === 0}
                  onClick={downloadAllSpeakingLogs}
                  className="px-3 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 disabled:bg-slate-800 disabled:text-slate-500 text-white text-[10px] font-bold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Tải tất cả (.json)
                </button>
              </div>

              {speakingLog.length === 0 ? (
                <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950 text-center text-xs text-slate-400">
                  Chưa có bài nói nào. Bài và nhận xét sẽ xuất hiện sau khi hoàn tất chấm điểm IELTS Speaking.
                </div>
              ) : (
                <div className="space-y-2">
                  {[...speakingLog].sort((a, b) => b.createdAt - a.createdAt).map(entry => (
                    <details key={entry.id} className="rounded-2xl border border-slate-800 bg-slate-950/90 overflow-hidden">
                      <summary className="p-3 cursor-pointer list-none flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[10px] text-slate-500">{new Date(entry.createdAt).toLocaleString()}</div>
                          <div className="text-xs text-white font-bold truncate">{entry.question}</div>
                        </div>
                        <span className="shrink-0 px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-black">Band {entry.overallBand}</span>
                      </summary>
                      <div className="px-3 pb-3 space-y-2 text-[11px]">
                        <div className="p-2 rounded-xl bg-slate-900 text-slate-200 whitespace-pre-wrap">{entry.transcript}</div>
                        <p className="text-slate-300">{entry.feedbackVi?.summary || entry.summary}</p>
                        {entry.feedbackVi?.suggestion && <p className="text-emerald-300">Gợi ý: {entry.feedbackVi.suggestion}</p>}
                        <div className="grid grid-cols-2 gap-1.5">
                          {Object.entries(entry.criteria).map(([name, result]) => (
                            <div key={name} className="p-2 rounded-lg bg-slate-900 text-slate-300">
                              <b className="text-amber-300">{name}: Band {result?.band ?? '—'}</b>
                              <div>{result?.feedback}</div>
                            </div>
                          ))}
                        </div>
                        {entry.fluencyDetail?.feedback && <p className="text-sky-300">Fluency: {entry.fluencyDetail.feedback}</p>}
                        {entry.grammarErrors.length > 0 && <div className="text-rose-200"><b>Ngữ pháp:</b> {entry.grammarErrors.map(error => `${error.error} → ${error.correction}`).join(' | ')}</div>}
                        {entry.pronunciationErrors.length > 0 && <div className="text-purple-200"><b>Phát âm:</b> {entry.pronunciationErrors.map(error => `${error.word} ${error.phonetic}: ${error.guide}`).join(' | ')}</div>}
                        {entry.feedbackVi?.weaknesses?.length ? <p className="text-rose-300">Cần cải thiện: {entry.feedbackVi.weaknesses.join(' · ')}</p> : null}
                        <button type="button" onClick={() => downloadSpeakingLog(entry)} className="px-3 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-[10px] font-bold flex items-center gap-1.5">
                          <Download className="w-3.5 h-3.5" /> Tải bài nói và nhận xét (.txt)
                        </button>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ======================================================== */}
          {/* PHONE SECTION 2: AUDIO & SOUND EFFECTS */}
          {/* ======================================================== */}
          {(selectedSection === 'all' || selectedSection === 'audio') && (
            <div className="animate-in fade-in duration-200">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Headphones className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Audio & Sound Effects</span>
                </div>
                <span className="text-[10px] text-cyan-400 font-mono">Audio</span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800/60 shadow-sm">
                {/* Sound Effects Toggle */}
                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                      {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Sound Effects</span>
                      <span className="text-[10px] text-slate-400 block">Match pops, elemental attacks & UI sounds</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      onToggleSound();
                    }}
                    className={`w-12 h-6 rounded-full transition-colors p-1 flex items-center cursor-pointer ${
                      soundEnabled ? 'bg-cyan-500 justify-end' : 'bg-slate-700 justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                  </button>
                </div>

                {/* Background Music Toggle */}
                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                      <Music className={`w-4 h-4 ${musicEnabled ? 'text-amber-400' : 'text-slate-500'}`} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Background Ambience</span>
                      <span className="text-[10px] text-slate-400 block">Atmospheric fantasy soundtrack</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      onToggleMusic();
                    }}
                    className={`w-12 h-6 rounded-full transition-colors p-1 flex items-center cursor-pointer ${
                      musicEnabled ? 'bg-amber-500 justify-end' : 'bg-slate-700 justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                  </button>
                </div>

                {/* Master Volume Slider */}
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-bold flex items-center gap-2">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                      Master Volume Level
                    </span>
                    <span className="text-amber-300 font-mono font-bold">{Math.round(volume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={e => onChangeVolume(parseFloat(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                </div>

                {/* AI Music Generator Studio */}
                <div className="p-3 bg-gradient-to-br from-indigo-950/40 via-purple-950/30 to-slate-950 border-t border-slate-800/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-bold text-white">AI Background Music Studio</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/40 font-mono">
                      Gemini Audio
                    </span>
                  </div>

                  {/* Currently Playing Track Pill */}
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2 truncate">
                      <Music className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                      <div className="truncate">
                        <span className="font-bold text-slate-200 block truncate">
                          {sound.getCurrentBgm()?.title || 'Celestial Odyssey'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {sound.getCurrentBgm()?.tempo || 124} BPM · {sound.getCurrentBgm()?.key || 'D Minor'}
                        </span>
                      </div>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${musicEnabled ? 'text-emerald-400 bg-emerald-950/60' : 'text-slate-500 bg-slate-800'}`}>
                      {musicEnabled ? 'PLAYING' : 'MUTED'}
                    </span>
                  </div>

                  {/* Preset Badges */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: '⚔️ Epic Battle', prompt: 'Intense fast-paced orchestral battle with brass and urgent drums' },
                      { label: '🌌 Mystic Sanctuary', prompt: 'Dreamy mystical ambient fantasy pads and celestial glockenspiel' },
                      { label: '⚡ Cyber Thunder', prompt: 'High-energy cyberpunk electro synthwave with driving bass' },
                      { label: '🍃 Cozy Academy', prompt: 'Gentle upbeat lo-fi chiptune acoustic piano study music' },
                    ].map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setAiBgmPrompt(preset.prompt);
                        }}
                        className="text-[10px] px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/60 cursor-pointer active:scale-95 transition-all"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom Prompt Input & Generate Button */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiBgmPrompt}
                      onChange={e => setAiBgmPrompt(e.target.value)}
                      placeholder="Describe your music style (e.g. Heroic Brass, Lo-Fi Chill)..."
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
                    />
                    <button
                      type="button"
                      disabled={isGeneratingBgm}
                      onClick={async () => {
                        sound.playClick();
                        setIsGeneratingBgm(true);
                        setBgmMessage(null);
                        try {
                          const comp = await sound.generateAiBgm(aiBgmPrompt || 'Epic RPG Fantasy Soundtrack');
                          setBgmMessage({ success: true, text: `Generated: "${comp.title}" (${comp.tempo} BPM)!` });
                          if (!musicEnabled) {
                            onToggleMusic();
                          }
                          sound.playRewardFanfare();
                        } catch (err: any) {
                          setBgmMessage({ success: false, text: err.message || 'Music generation failed' });
                          sound.playWrong();
                        } finally {
                          setIsGeneratingBgm(false);
                        }
                      }}
                      className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      {isGeneratingBgm ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>AI Composing...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>Compose</span>
                        </>
                      )}
                    </button>
                  </div>

                  {bgmMessage && (
                    <div className={`p-1.5 rounded-lg text-[10px] font-bold text-center ${bgmMessage.success ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40' : 'bg-rose-950/60 text-rose-300 border border-rose-500/40'}`}>
                      {bgmMessage.text}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* PHONE SECTION 3: EDTECH & COMBAT GUIDANCE */}
          {/* ======================================================== */}
          {(selectedSection === 'all' || selectedSection === 'edtech') && (
            <div className="animate-in fade-in duration-200">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                  <span>EdTech & Academy Guidance</span>
                </div>
                <span className="text-[10px] text-indigo-400 font-mono">EdTech</span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800/60 shadow-sm">
                {/* Speaking question bank selector */}
                <div className="p-3.5 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                        <SlidersHorizontal className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">Định dạng câu hỏi trận đấu (Question Mode)</span>
                        <span className="text-[10px] text-slate-400 block">
                          Mỗi Phase 1 có một câu Speaking; chọn ngân hàng câu hỏi.
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        onChangeQuestionMode?.('random');
                      }}
                      className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 relative ${
                        questionMode === 'random'
                          ? 'bg-amber-500/20 border-amber-400 text-white shadow-lg shadow-amber-500/20 ring-1 ring-amber-400'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black font-game text-amber-300">🎲 Random</span>
                        {questionMode === 'random' && (
                          <span className="text-[9px] px-1.5 py-0.2 bg-amber-400 text-slate-950 font-black rounded-full uppercase">
                            Ngẫu nhiên
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-300 leading-snug">
                        Chọn ngẫu nhiên 1 câu từ ngân hàng IELTS Speaking có sẵn.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        onChangeQuestionMode?.('part1_preference');
                      }}
                      className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 relative ${
                        questionMode === 'part1_preference'
                          ? 'bg-indigo-500/20 border-indigo-400 text-white shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-400'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black font-game text-indigo-300">🗣️ Part 1 Preference</span>
                        {questionMode === 'part1_preference' && (
                          <span className="text-[9px] px-1.5 py-0.2 bg-indigo-400 text-slate-950 font-black rounded-full uppercase">
                            Đang chọn
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-300 leading-snug">
                        Lấy ngẫu nhiên 1 câu trong bộ câu hỏi Part 1 Preference.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        onChangeQuestionMode?.('part3_forecast_2026');
                      }}
                      className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 relative ${
                        questionMode === 'part3_forecast_2026'
                          ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-black font-game text-cyan-300">📚 Part 3 Forecast 2026</span>
                        {questionMode === 'part3_forecast_2026' && (
                          <span className="text-[9px] px-1.5 py-0.2 bg-cyan-400 text-slate-950 font-black rounded-full uppercase shrink-0">
                            Đang chọn
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-300 leading-snug">
                        Dùng ngân hàng câu hỏi Speaking Part 3 Forecast 2026 gồm 20 chủ đề.
                      </span>
                    </button>
                  </div>
                </div>

                {/* Speaking Hints Toggle */}
                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Gợi ý Speaking (Speaking Hints)</span>
                      <span className="text-[10px] text-slate-400 block">
                        {showSpeakingHints
                          ? 'Đang bật: Hiện câu trả lời mẫu & gợi ý từ vựng'
                          : 'Đang tắt: Ẩn gợi ý (Chế độ thi IELTS chuẩn)'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      onToggleSpeakingHints();
                    }}
                    className={`w-12 h-6 rounded-full transition-colors p-1 flex items-center cursor-pointer ${
                      showSpeakingHints ? 'bg-indigo-500 justify-end' : 'bg-slate-700 justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                  </button>
                </div>

                {/* Combat Academy Tutorial row */}
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    onOpenTutorial();
                  }}
                  className="w-full p-3 flex items-center justify-between hover:bg-slate-900/90 active:bg-slate-850 transition-colors text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Hướng Dẫn Học Viện Chiến Đấu</span>
                      <span className="text-[10px] text-slate-400 block">
                        Học về MCQ, IELTS Speaking, Match-3 & Vòng tròn 6 nguyên tố
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* PHONE SECTION 4: REDEEM CODE & UNITTEST */}
          {/* ======================================================== */}
          {(selectedSection === 'all' || selectedSection === 'redeem') && (
            <div className="animate-in fade-in duration-200">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5 text-amber-400" />
                  <span>Redeem Code</span>
                </div>
                <span className="text-[10px] text-amber-400 font-mono">Redeem</span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-2.5 shadow-sm">
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-amber-200 font-mono">Vietthongminh</span>
                    <span className="text-[10px] font-bold text-emerald-300">+2.000 Gems</span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-300">Mỗi tài khoản chỉ nhận được một lần.</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Nhập Mã Code Quà Tặng</span>
                  {isUnitTestActive ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-bold flex items-center gap-1 animate-pulse">
                      <Sparkles className="w-3 h-3 text-emerald-400" /> Đặc Quyền Đang Kích Hoạt ({remainingDays}d)
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-400/80 font-mono">Redeem</span>
                  )}
                </div>

                <form onSubmit={handleRedeem} className="flex gap-2">
                  <input
                    type="text"
                    value={redeemInput}
                    onChange={e => setRedeemInput(e.target.value)}
                    placeholder="Enter code"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold font-game text-xs rounded-xl transition-all shadow cursor-pointer active:scale-95"
                  >
                    Redeem
                  </button>
                </form>

                {redeemFeedback && (
                  <div
                    className={`p-2 rounded-xl text-[11px] font-bold flex items-start gap-1.5 ${
                      redeemFeedback.success
                        ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                        : 'bg-rose-950/60 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    {redeemFeedback.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <span>{redeemFeedback.message}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* PHONE SECTION 5: DISPLAY & GRAPHICS */}
          {/* ======================================================== */}
          {(selectedSection === 'all' || selectedSection === 'display') && (
            <div className="animate-in fade-in duration-200">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-teal-400" />
                  <span>Display & Performance</span>
                </div>
                <span className="text-[10px] text-teal-400 font-mono">Display</span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800/60 shadow-sm">
                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Graphics Performance</span>
                      <span className="text-[10px] text-slate-400 block">Smooth 60 FPS Particle simulation & animations</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold rounded-lg font-mono">
                    High (60 FPS)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* PHONE SECTION 6: RESET DATA & DANGER ZONE */}
          {/* ======================================================== */}
          {(selectedSection === 'all' || selectedSection === 'reset') && (
            <div className="animate-in fade-in duration-200">
              <div className="text-[11px] font-bold uppercase tracking-wider text-rose-400 px-2 mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                  <span>XÓA TIẾN TRÌNH & BẮT ĐẦU LẠI TỪ ĐẦU (FACTORY RESET)</span>
                </div>
                <span className="text-[10px] text-rose-400 font-mono">Reset & Reload</span>
              </div>
              <div className="bg-slate-950/80 border border-rose-900/60 rounded-2xl p-3.5 shadow-sm space-y-2.5">
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Xóa toàn bộ dữ liệu tiến trình, đưa tài khoản về khởi điểm ban đầu: <strong className="text-amber-300">Level 1, 0 Vàng, 0 Kim Cương, 2 Gói Khởi Đầu, 0 Starmon</strong> và tự động tải lại trang web (Reload page).
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('⚠️ BẠN CÓ CHẮC CHẮN MUỐN RESET TOÀN BỘ TIẾN TRÌNH?\n\nHành động này sẽ xóa sạch dữ liệu game, đưa tài khoản về Level 1, 0 Vàng, 0 Kim Cương, 2 Gói Khởi Đầu, 0 Starmon và làm mới lại toàn bộ trang web để bắt đầu lại từ đầu.')) {
                      onResetData();
                    }
                  }}
                  className="w-full p-2.5 rounded-xl bg-gradient-to-r from-rose-950 via-rose-900 to-rose-950 hover:from-rose-900 hover:to-rose-800 border border-rose-500/60 text-rose-100 text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer group active:scale-98 shadow-lg shadow-rose-950/40"
                >
                  <RotateCcw className="w-4 h-4 text-rose-300 group-hover:-rotate-90 transition-transform" />
                  <span>🔄 Reset Toàn Bộ Tiến Trình & Khởi Động Lại (Reload Page)</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="border-t border-slate-800 px-5 py-3 bg-slate-950/90 flex items-center justify-between shrink-0">
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            Click outside box to close settings
          </span>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 text-xs font-black font-game rounded-xl transition-all shadow-md shadow-amber-500/20 cursor-pointer active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
