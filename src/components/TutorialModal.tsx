import React from 'react';
import { sound } from '../services/sound';
import { GOLD_IMAGE } from '../data/itemsData';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Swords,
  Shield,
  Zap,
  Target,
  Mic,
  CheckCircle2,
  Flame,
  Droplets,
  Wind,
  Layers,
  ArrowRight,
  BookOpen,
  Play
} from 'lucide-react';

interface Props {
  onClose: () => void;
  onStartTutorialMatch?: (stage: 1 | 2 | 3 | 'abilities') => void;
  hasClaimedTutorial1Reward?: boolean;
}

export const TutorialModal: React.FC<Props> = ({ onClose, onStartTutorialMatch, hasClaimedTutorial1Reward = false }) => {
  const [selectedTutorial, setSelectedTutorial] = React.useState<1 | 'abilities'>(1);
  const handleStartMatch = () => {
    sound.playClick();
    if (onStartTutorialMatch) {
      onStartTutorialMatch(selectedTutorial);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-base md:text-lg font-black font-game text-white tracking-wide">
                  {selectedTutorial === 1 ? 'TUTORIAL 1: BATTLE BASIC' : 'TUTORIAL 2: ABILITIES & TARGETS'}
                </h3>
                <button
                  onClick={handleStartMatch}
                  className="px-3.5 py-1 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black font-game text-xs md:text-sm shadow-md shadow-amber-500/30 cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-slate-950" />
                  <span>Bắt đầu</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {selectedTutorial === 1 ? 'Trả lời câu hỏi và ghép ngọc để tấn công kẻ thù.' : 'Đổi mục tiêu, xem Starmon, nhận mana và kích hoạt kỹ năng chủ động.'}
              </p>
            </div>
          </div>

          {/* Close Window Button */}
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-all cursor-pointer ml-2 shrink-0"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tutorial selection and selected tutorial details */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button onClick={() => { sound.playClick(); setSelectedTutorial(1); }} className={`p-4 rounded-2xl border-2 text-left transition-all ${selectedTutorial === 1 ? 'border-amber-400 bg-amber-950/40 ring-2 ring-amber-400/20' : 'border-slate-700 bg-slate-950/70 hover:border-slate-500'}`}>
              <div className="font-black font-game text-white">Tutorial 1</div><div className="text-amber-300 font-bold text-sm">Battle Basic</div><p className="text-xs text-slate-400 mt-1">Câu hỏi, Match-3 và cách tấn công cơ bản.</p>
            </button>
            <button onClick={() => { sound.playClick(); setSelectedTutorial('abilities'); }} className={`p-4 rounded-2xl border-2 text-left transition-all ${selectedTutorial === 'abilities' ? 'border-cyan-400 bg-cyan-950/40 ring-2 ring-cyan-400/20' : 'border-slate-700 bg-slate-950/70 hover:border-slate-500'}`}>
              <div className="font-black font-game text-white">Tutorial 2</div><div className="text-cyan-300 font-bold text-sm">Abilities &amp; Targets</div><p className="text-xs text-slate-400 mt-1">Chọn mục tiêu, xem Starmon, ghép orb lấy mana và dùng kỹ năng.</p>
            </button>
          </div>
          {selectedTutorial === 2 ? null : null}
          {selectedTutorial === 'abilities' ? (
            <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/40 space-y-3">
              <div className="text-xs md:text-sm text-cyan-100"><strong className="text-cyan-300">Mục tiêu:</strong> Học bằng thao tác trực tiếp với pointer hướng dẫn từng bước.</div>
              <div className="grid gap-2 text-xs text-slate-300">
                <p>1. Đổi mục tiêu lần lượt từ Starmon 1 sang 2, rồi sang 3.</p><p>2. Ấn vào Starmon 1 để đọc chỉ số và kỹ năng.</p><p>3. Ghép orb bất kỳ để nhận mana: mỗi orb cho 5 mana.</p><p>4. Khi đủ mana, kích hoạt kỹ năng chủ động.</p>
              </div>
              <div className="text-[11px] text-slate-400">Bản hướng dẫn này sẽ dùng các pointer theo từng thao tác trong trận.</div>
            </div>
          ) : (
          <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/40 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs md:text-sm text-amber-200 leading-relaxed">
              <strong className="text-amber-300 font-game">Mục tiêu Hướng dẫn 1:</strong> Làm quen hoàn chỉnh với câu hỏi Trắc nghiệm (MCQ), Bảng ghép ngọc Match-3 Grid (8x8), và phần thi IELTS Speaking!
            </div>
          </div>
          )}

          {/* Reward Status Banner */}
          {selectedTutorial === 1 && <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-amber-400/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <img src={GOLD_IMAGE} alt="Gold" className="h-7 w-7 object-contain" />
              <div>
                <div className="text-xs font-black font-game text-amber-300">Phần Thưởng Hoàn Thành: 1,000 Vàng</div>
                <div className="text-[11px] text-slate-400">
                  {hasClaimedTutorial1Reward ? 'Bạn đã nhận 1,000 Vàng trước đó (không nhận lại ở các lần sau)' : 'Chỉ nhận một lần duy nhất khi hoàn thành ải'}
                </div>
              </div>
            </div>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
              hasClaimedTutorial1Reward ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
            }`}>
              {hasClaimedTutorial1Reward ? 'Đã nhận' : '1,000 Vàng'}
            </span>
          </div>}

          {/* Special Voltlynx Lineup Notice */}
          {selectedTutorial === 1 && <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-slate-950 border-2 border-amber-400/60 shadow-lg flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0">
              <Zap className="w-6 h-6 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black font-game text-white">Đội Hình Tham Chiến: 1 Starmon Duy Nhất (Voltlynx ⚡)</h4>
                <span className="text-[10px] px-2 py-0.2 rounded-full bg-purple-500/30 text-purple-200 border border-purple-500/50 font-bold">
                  Khách Mời Đặc Biệt
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                Trong màn hướng dẫn này, bạn sẽ trực tiếp chỉ huy <strong>Voltlynx (DPS hệ Electric)</strong>. Voltlynx chỉ xuất hiện tạm thời trong màn hướng dẫn để bạn luyện tập và không được thêm vào kho Starmon cá nhân của bạn (muốn sở hữu bạn vẫn cần mở khóa bằng thẻ bài như bình thường).
              </p>
            </div>
          </div>}

          {/* 3 Step Phases Overview */}
          {selectedTutorial === 1 && <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Phase 1: MCQ */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center text-sm font-bold">
                    1
                  </div>
                  <h4 className="text-sm font-bold text-white font-game">🎯 Trắc Nghiệm (MCQ)</h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Làm quen với khung câu hỏi và các đáp án A, B, C, D.
                </p>
                <div className="mt-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] space-y-1">
                  <div className="text-emerald-400 font-bold">✓ Chọn đúng:</div>
                  <p className="text-slate-400">Starmon 1 nhận được lượt hành động tấn công!</p>
                  <div className="text-rose-400 font-bold mt-1">✗ Chọn sai:</div>
                  <p className="text-slate-400">Starmon sẽ bị mất lượt.</p>
                </div>
              </div>
            </div>

            {/* Phase 2: Match-3 */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm font-bold">
                    2
                  </div>
                  <h4 className="text-sm font-bold text-white font-game">⚔️ Ghép Ngọc (Match-3)</h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Hoán đổi vị trí 2 viên ngọc để tạo chuỗi 3 ngọc cùng màu trở lên.
                </p>
                <div className="mt-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] space-y-1">
                  <div className="text-amber-300 font-bold">Bảng ngọc 8x8 & Thanh HP:</div>
                  <p className="text-slate-400">Đòn đánh làm giảm HP của đối thủ. Khi HP kẻ địch về 0, quái vật sẽ gục ngã (faint)!</p>
                </div>
              </div>
            </div>

            {/* Phase 3: Speaking */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-sm font-bold">
                    3
                  </div>
                  <h4 className="text-sm font-bold text-white font-game">🎙️ IELTS Speaking</h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Luyện nói tiếng Anh trực tiếp qua Microphone trong 20 - 30 giây.
                </p>
                <div className="mt-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] space-y-1">
                  <div className="text-purple-300 font-bold">Yêu cầu qua ải:</div>
                  <p className="text-slate-400">Điểm Overall phải đạt từ <strong>5.5 trở lên</strong> để nhận lượt tấn công kết liễu trận đấu!</p>
                </div>
              </div>
            </div>
          </div>}
        </div>

        {/* Footer Action */}
        <div className="flex items-center justify-between border-t border-slate-800 px-5 py-4 bg-slate-950/90 shrink-0 gap-3">
          <div className="text-xs text-slate-400 font-mono">
            {selectedTutorial === 1 ? 'Battle Basic · Trận hướng dẫn riêng' : 'Abilities & Targets · Trận hướng dẫn tương tác'}
          </div>

          <button
            onClick={handleStartMatch}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black font-game text-sm md:text-base flex items-center gap-2 shadow-xl shadow-amber-500/25 cursor-pointer active:scale-95 transition-all"
          >
            <Play className="w-5 h-5 fill-slate-950" />
            <span>BẮT ĐẦU</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
