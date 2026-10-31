import React, { useState, useEffect } from 'react';
import { QuizQuestion, Starmon } from '../types';
import { sound } from '../services/sound';
import {
  Sparkles,
  Play,
  ChevronRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export interface TutorialSpotlightProps {
  stage: 1 | 2 | 3 | 'abilities';
  phase: 'phase1_quiz' | 'phase2_combat' | 'victory' | 'defeat';
  currentQuestion?: QuizQuestion;
  selectedEnemyIndex: number;
  playerTeam: Starmon[];
  enemyTeam: Starmon[];
  hasSwappedOrbs?: boolean;
  hasRecordedSpeaking?: boolean;
  hasSelectedAbility?: boolean;
  ieltsAiResult?: any;
  tutorialRound?: 1 | 2; // Round 1: MCQ -> Match-3 -> HP bar; Round 2: IELTS Speaking -> Match-3 -> Complete!
  tutorialElementalActionStep?: number;
  mcqCorrectSelected?: boolean;
  onSkip?: () => void;
  onNextStage?: (next: 1 | 2 | 3) => void;
  onAdvanceToMatch3?: () => void;
  onAdvanceToSpeaking?: () => void;
  onAdvanceToFinalAttack?: () => void;
  onFinishTutorial?: () => void;
  selectedPlayerIndex?: number;
  onSelectPlayer?: (index: number) => void;
  onSelectEnemy?: (index: number) => void;
  playerMana?: number;
  tutorialRequiredMana?: number;
  onTutorial2Inspect?: () => void;
  onTutorial2Cast?: () => void;
  tutorial2CastDone?: boolean;
  tutorial2InspectOpen?: boolean;
  tutorial2InspectStep?: number;
  onTutorial2InspectNext?: () => void;
}

export const TutorialSpotlight: React.FC<TutorialSpotlightProps> = ({
  stage,
  phase,
  currentQuestion,
  hasSwappedOrbs = false,
  hasRecordedSpeaking = false,
  ieltsAiResult,
  tutorialRound = 1,
  tutorialElementalActionStep = 0,
  mcqCorrectSelected = false,
  onSkip,
  onAdvanceToMatch3,
  onAdvanceToSpeaking,
  onAdvanceToFinalAttack,
  selectedEnemyIndex,
  selectedPlayerIndex = 0,
  onSelectPlayer,
  onSelectEnemy,
  playerMana = 0,
  tutorialRequiredMana = 20,
  onTutorial2Inspect,
  onTutorial2Cast,
  tutorial2CastDone = false,
  tutorial2InspectOpen = false,
  tutorial2InspectStep = 0,
  onTutorial2InspectNext,
  playerTeam,
}) => {
  // =========================================================================
  // TUTORIAL 1 STEP STATE MACHINE:
  // Step 0: Initial Screen -> "TUTORIAL 1: Game mechanics" with START button beside & below
  // Step 1: MCQ Phase (0s) -> Highlight Question Box & Options. Hand Pointer points at Question Text.
  //         Text: "Here is the question. You will need to choose the correct answer." Button: "I understand!"
  // Step 2: MCQ Phase -> Hand Pointer moves to point at Correct Answer.
  //         Text: "If you choose correctly, your Starmon will get to attack. If you choose incorrectly, it will lose its turn."
  // Step 3: MCQ Phase (Khi chọn đúng) -> Popup: "Congratulations! Your Starmon 1 will get to attack this turn."
  // Step 4: Match-3 Phase (Bước 1) -> Highlight Grid 8x8. Hand Pointer points at 2 switchable orbs.
  //         Text: "Switch position of these 2 orbs."
  // Step 5: Match-3 Phase (Bước 2 - Sau khi hoán đổi thành công) -> Popup: "Congratulations! You have learned how to attack the enemies."
  // Step 6: Match-3 Phase (Bước 3) -> Highlight Enemy HP bar. Hand Pointer points at Enemy HP.
  //         Text: "This is the enemy's HP. Your attack reduces their HP. When the HP hits 0, this Starmon will faint and no longer can battle."
  // Step 7: IELTS Speaking Phase (Bước 1 - 0s) -> Highlight Speaking Question Box. Hand Pointer points at Question.
  //         Text: "This is IELTS Speaking question. You will have to answer it for around 20 to 30 seconds."
  // Step 8: IELTS Speaking Phase (Bước 2 - Sau 6s) -> Highlight Mic Button. Hand Pointer points at Mic.
  //         Text: "Click here to record your answer."
  // Step 9: IELTS Speaking Phase (Bước 3 - Sau khi thu âm xong) -> Popup:
  //         "Your speaking answer must get 5.5 Overall or higher to attack. If it is lower than 5.5, your Starmon will lose its turn."
  // Step 10: Final Match-3 Attack -> Complete Tutorial 1!
  // =========================================================================
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [step, setStep] = useState<number>(0);
  const [targetTutorialStep, setTargetTutorialStep] = useState(0);
  const [targetRect, setTargetRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [instructionText, setInstructionText] = useState<string>('');
  const [handPos, setHandPos] = useState<{ x: number; y: number; angle: number }>({ x: 200, y: 200, angle: 0 });
  const [popupData, setPopupData] = useState<{
    title: string;
    message: string;
    buttonText: string;
    onAction: () => void;
  } | null>(null);

  useEffect(() => {
    if (stage !== 'abilities') return;
    const finish = () => onSkip?.();
    window.addEventListener('tutorial2-finish', finish);
    return () => window.removeEventListener('tutorial2-finish', finish);
  }, [stage, onSkip]);

  // Helper to dynamically locate elements in DOM and set spotlight cutouts and hand position
  const updateSpotlight = (
    highlightSelectorOrId: string,
    pointerTargetSelectorOrId: string | null,
    text: string,
    handAngle: number = 0,
    handOffsetX: number = 0,
    handOffsetY: number = 0
  ) => {
    const highlightEl = document.getElementById(highlightSelectorOrId) || document.querySelector(highlightSelectorOrId);
    const pointerEl = pointerTargetSelectorOrId
      ? document.getElementById(pointerTargetSelectorOrId) || document.querySelector(pointerTargetSelectorOrId)
      : highlightEl;

    if (highlightEl) {
      const rect = highlightEl.getBoundingClientRect();
      const padding = 10;
      const spotRect = {
        x: Math.max(6, rect.left - padding),
        y: Math.max(6, rect.top - padding),
        width: Math.min(window.innerWidth - 12, rect.width + padding * 2),
        height: rect.height + padding * 2,
      };
      setTargetRect(spotRect);

      if (pointerEl) {
        const pRect = pointerEl.getBoundingClientRect();
        setHandPos({
          x: pRect.left + pRect.width / 2 + handOffsetX,
          y: pRect.top + pRect.height / 2 + handOffsetY,
          angle: handAngle,
        });
      } else {
        setHandPos({
          x: spotRect.x + spotRect.width / 2 + handOffsetX,
          y: spotRect.y + spotRect.height / 2 + handOffsetY,
          angle: handAngle,
        });
      }
      setInstructionText(text);
    } else {
      // Fallback
      setTargetRect({
        x: window.innerWidth * 0.15,
        y: window.innerHeight * 0.25,
        width: window.innerWidth * 0.7,
        height: window.innerHeight * 0.45,
      });
      setHandPos({
        x: window.innerWidth * 0.5,
        y: window.innerHeight * 0.35,
        angle: 0,
      });
      setInstructionText(text);
    }
  };

  // Re-measure on window resize
  useEffect(() => {
    const handleResize = () => setStep(s => s);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle clicking START to begin Tutorial 1
  const handleStartTutorial = () => {
    sound.playClick();
    setIsStarted(true);
    setStep(1);
  };

  const advanceElementalTutorial = () => {
    sound.playClick();
    if (step === 5 && selectedEnemyIndex !== 1) {
      sound.playWrong();
      return;
    }
    if (step >= 7) onSkip?.();
    else if (step === 3) {
      onSelectEnemy?.(0);
      setStep(4);
    } else if (step === 5) {
      onSelectEnemy?.(1);
      setStep(6);
    } else setStep(current => current + 1);
  };

  // Step 1 -> Step 2 transition when clicking "I understand!"
  const handleUnderstandStep1 = () => {
    sound.playClick();
    setStep(2);
  };

  // ==========================================
  // PHASE & STEP TIMERS / OBSERVERS
  // ==========================================
  useEffect(() => {
    if (stage === 'abilities') {
      if (!isStarted) return;
      if (tutorial2InspectOpen) {
        const inspectTargets = [
          ['tutorial-inspect-base-stats', 'Đây là chỉ số gốc của Starmon.'],
          ['tutorial-inspect-vitals', 'Đây là Thanh Sinh Lực (HP) và Thanh Năng Lượng (Mana) hiện tại của Starmon.'],
          ['tutorial-inspect-passive', 'Đây là Nội Tại (Passive) của Starmon. Kỹ năng này tự động kích hoạt trong trận đấu.'],
          ['tutorial-inspect-active', 'Đây là Chiêu Kích Hoạt (Abilities). Ấn dấu mũi tên để dùng chiêu; chiêu tốn mana và Starmon sẽ mất lượt ghép orb.'],
          ['tutorial-inspect-close', 'Ấn CLOSE để đóng bảng thông tin và quay lại trận đấu.'],
        ] as const;
        const [targetId, text] = inspectTargets[Math.min(4, Math.max(0, tutorial2InspectStep))];
        const target = document.getElementById(targetId);
        if (!target) return;
        target.scrollIntoView({ block: 'nearest' });
        const frame = window.requestAnimationFrame(() => updateSpotlight(targetId, targetId, text, 0, -35, 0));
        return () => window.cancelAnimationFrame(frame);
      }
      if (targetTutorialStep < 2) {
        const target = targetTutorialStep;
        const nextTarget = target + 1;
        const el = document.getElementById(`tutorial-target-${nextTarget}`);
        if (el) updateSpotlight(`tutorial-target-${nextTarget}`, `tutorial-target-${nextTarget}`, `Mục tiêu hiện tại là Starmon ${target + 1}. Hãy ấn vào khung Starmon ${nextTarget + 1} để đổi mục tiêu.`, 0, -35, 0);
      } else if (targetTutorialStep === 2) {
        const avatarId = 'tutorial-starmon-avatar-0';
        const el = document.getElementById(avatarId);
        if (el) updateSpotlight(avatarId, avatarId, 'Ấn vào ảnh Starmon 1 để xem chỉ số và kỹ năng.', 0, -35, 0);
      } else if (targetTutorialStep === 5) {
        updateSpotlight('tutorial-match-grid', 'tutorial-match-grid', `Ghép orb bất kỳ để nhận 5 mana cho mỗi orb. Cần ${tutorialRequiredMana} mana để dùng chiêu; hiện Starmon có ${playerMana}.`, 90, 0, -35);
      } else if (targetTutorialStep === 6) {
        updateSpotlight('tutorial-mana-bar', 'tutorial-mana-bar', `Mỗi orb được ghép, bất kể hệ nào, cho 5 mana. Starmon hiện có ${playerMana} mana để dùng chiêu chủ động.`, 0, -35, 0);
      } else if (targetTutorialStep === 7) {
        updateSpotlight('tutorial-active-skill', 'tutorial-active-skill', 'Kỹ năng chủ động cần mana. Ấn vào nút kích hoạt của kỹ năng khi Starmon có đủ mana.', 0, -35, 0);
      } else {
        setTargetRect(null);
        setPopupData({ title: 'Hoàn thành Tutorial 2!', message: 'Bạn đã biết cách đổi mục tiêu, xem Starmon, nhận mana từ orb và kích hoạt kỹ năng chủ động.', buttonText: 'Về sảnh', onAction: () => window.dispatchEvent(new CustomEvent('tutorial2-finish')) });
      }
      return;
    }
    if (stage === 3 && isStarted) {
      if (step === 4 && tutorialElementalActionStep >= 1) {
        setStep(5);
        return;
      }
      if (step === 6 && tutorialElementalActionStep >= 2) {
        setStep(7);
        return;
      }
      const steps = [
        ['tutorial-elemental-wheel', 'tutorial-elemental-wheel', 'Vòng khắc chế: Water → Fire → Metal → Wind → Earth → Electric → Water. Counter cộng 10%; Resistance trừ 10%.'],
        ['tutorial-player-starmon-0', 'tutorial-player-starmon-0', `${playerTeam[0]?.name || 'Starmon Water'} là Starmon Water dùng trong bài tập. Water kháng Fire: Fire Orbs và kỹ năng gây Fire DMG gây ít hơn 10% sát thương lên Starmon hệ Water.`],
        ['tutorial-element-target-0', 'tutorial-element-target-0', 'Chọn Fire Target. Tiếp theo, ghép Water orb: hệ của orb quyết định đòn là Water, không phải hệ của người dùng.'],
        ['tutorial-match-grid', 'tutorial-swap-orb-1', 'Đổi cặp orb được đánh dấu để tạo thành chuỗi 3 Water Orbs.\n\nKhi Starmon hệ Water nối Water Orbs, đòn tấn công gây thêm 10% sát thương.\n\nDùng Water Orbs tấn công kẻ địch hệ Fire sẽ gây thêm 10% sát thương nữa.'],
        ['tutorial-element-target-1', 'tutorial-element-target-1', 'Chọn Glidron làm mục tiêu cho lượt ghép tiếp theo. Glidron có hai hệ Wind/Electric.'],
        ['tutorial-match-grid', 'tutorial-swap-orb-1', 'Đổi cặp Water orb được đánh dấu để đánh Glidron. Electric resists Water (−10%); modifier này được tính riêng với same-element bonus của Starmon Water.'],
        ['tutorial-elemental-wheel', 'tutorial-elemental-wheel', 'Tóm tắt: Water orb đánh Fire được Counter +10%; Water orb đánh Glidron bị Electric kháng −10%. Fire attacks/Fire DMG đánh Water cũng bị kháng −10%. Với mục tiêu hai hệ, các modifier triệt tiêu: Earth đánh Wind/Electric gây trung tính vì Wind kháng Earth nhưng Electric yếu trước Earth.'],
      ] as const;
      const [highlightId, pointerId, text] = steps[Math.min(6, Math.max(0, step - 1))];
      if (document.getElementById(highlightId)) updateSpotlight(highlightId, pointerId, text, 0, -35, 0);
      return;
    }
    if (stage !== 1 || !isStarted) return;

    if (phase === 'phase1_quiz') {
      const isSpeaking = currentQuestion?.type === 'speaking';

      if (!isSpeaking) {
        // Step 1: 0s -> Highlight Khung Câu hỏi & Các đáp án. Hand Pointer chỉ vào Khung Câu hỏi.
        if (step === 1) {
          setPopupData(null);
          updateSpotlight(
            'tutorial-question-box',
            'tutorial-question-text',
            'Đây là câu hỏi. Bạn cần chọn đáp án chính xác.',
            -45,
            -35,
            -35
          );
        }

        // Step 2: Hand Pointer Di chuyển chỉ vào Đáp án đúng
        if (step === 2) {
          setPopupData(null);
          updateSpotlight(
            'tutorial-correct-option',
            'tutorial-correct-option',
            'Nếu bạn chọn đúng, Starmon của bạn sẽ được tấn công. Nếu bạn chọn sai, Starmon sẽ bị mất lượt.',
            0,
            -45,
            0
          );
        }
      } else {
        // Phase 3: IELTS Speaking Phase
        if (step < 7) {
          setStep(7);
        }

        // Step 7 (Bước 1): Highlight Khung câu hỏi IELTS Speaking. Hand Pointer chỉ vào Câu hỏi.
        if (step === 7) {
          setPopupData(null);
          updateSpotlight(
            'tutorial-speaking-box',
            'tutorial-speaking-question',
            'Đây là câu hỏi IELTS Speaking. Bạn sẽ cần trả lời trong khoảng từ 20 đến 30 giây.',
            -45,
            -30,
            -35
          );

          // Bước 2: Sau 6s -> Highlight Nút Mic "Tap to Record", Hand Pointer chỉ vào Nút Mic.
          const timer = setTimeout(() => {
            if (!hasRecordedSpeaking) {
              setStep(8);
            }
          }, 6000);
          return () => clearTimeout(timer);
        }

        // Step 8 (Bước 2): Hand Pointer chỉ vào Nút Mic
        if (step === 8) {
          setPopupData(null);
          updateSpotlight(
            'tutorial-mic-btn',
            'tutorial-mic-btn',
            'Nhấp vào đây để ghi âm câu trả lời của bạn.',
            -90,
            0,
            -45
          );
        }
      }
    } else if (phase === 'phase2_combat') {
      if (tutorialRound === 1) {
        // Phase 2: Match-3 Phase (Round 1)
        if (step < 4) {
          setStep(4);
        }

        // Step 4: Highlight Chỉ sáng 2 viên Ngọc có thể hoán đổi để tạo thành hàng 3 ngọc cùng loại
        if (step === 4) {
          setPopupData(null);
          const orbEl1 = document.getElementById('tutorial-swap-orb-1');
          const orbEl2 = document.getElementById('tutorial-swap-orb-2');
          const gridEl = document.getElementById('tutorial-match-grid');

          if (orbEl1 && orbEl2) {
            const r1 = orbEl1.getBoundingClientRect();
            const r2 = orbEl2.getBoundingClientRect();
            const minX = Math.min(r1.left, r2.left);
            const minY = Math.min(r1.top, r2.top);
            const maxX = Math.max(r1.right, r2.right);
            const maxY = Math.max(r1.bottom, r2.bottom);

            setTargetRect({
              x: Math.max(4, minX - 6),
              y: Math.max(4, minY - 6),
              width: maxX - minX + 12,
              height: maxY - minY + 12,
            });

            setHandPos({
              x: (r1.left + r1.width / 2 + r2.left + r2.width / 2) / 2,
              y: minY - 26,
              angle: 90,
            });
            setInstructionText('Hoán đổi vị trí 2 viên ngọc này để tạo thành hàng 3 ngọc cùng màu!');
          } else if (gridEl) {
            const gRect = gridEl.getBoundingClientRect();
            setTargetRect({
              x: Math.max(6, gRect.left - 8),
              y: Math.max(6, gRect.top - 8),
              width: gRect.width + 16,
              height: gRect.height + 16,
            });
            setHandPos({
              x: gRect.left + gRect.width / 2,
              y: gRect.top + 40,
              angle: 90,
            });
            setInstructionText('Hoán đổi vị trí 2 viên ngọc liền kề để tạo thành hàng 3 ngọc!');
          }
        }

        // Step 6 (Bước 3): Highlight Chỉ sáng Thanh HP của Đối thủ. Hand Pointer chỉ vào Thanh HP đối thủ.
        if (step === 6) {
          setPopupData(null);
          updateSpotlight(
            'tutorial-enemy-hp-0',
            'tutorial-enemy-hp-0',
            "Đây là thanh HP của đối thủ. Đòn tấn công của bạn sẽ trừ HP của chúng. Khi HP giảm về 0, Starmon này sẽ bị hạ gục và không thể tiếp tục chiến đấu.",
            0,
            -45,
            0
          );
        }
      } else {
        // Round 2: Lượt tấn công cuối cùng sau IELTS Speaking
        setStep(10);
        setPopupData(null);
        const orbEl1 = document.getElementById('tutorial-swap-orb-1');
        const orbEl2 = document.getElementById('tutorial-swap-orb-2');
        const gridEl = document.getElementById('tutorial-match-grid');

        if (orbEl1 && orbEl2) {
          const r1 = orbEl1.getBoundingClientRect();
          const r2 = orbEl2.getBoundingClientRect();
          const minX = Math.min(r1.left, r2.left);
          const minY = Math.min(r1.top, r2.top);
          const maxX = Math.max(r1.right, r2.right);
          const maxY = Math.max(r1.bottom, r2.bottom);

          setTargetRect({
            x: Math.max(4, minX - 6),
            y: Math.max(4, minY - 6),
            width: maxX - minX + 12,
            height: maxY - minY + 12,
          });

          setHandPos({
            x: (r1.left + r1.width / 2 + r2.left + r2.width / 2) / 2,
            y: minY - 26,
            angle: 90,
          });
          setInstructionText('Hoán đổi vị trí 2 viên ngọc này để Voltlynx tung đòn sấm sét kết liễu!');
        } else {
          updateSpotlight(
            'tutorial-match-grid',
            null,
            'Hoán đổi vị trí các viên ngọc để Voltlynx tung đòn sấm sét kết liễu và hoàn thành Hướng dẫn 1!',
            90,
            0,
            -40
          );
        }
      }
    }
  }, [stage, isStarted, phase, step, currentQuestion, tutorialRound, targetTutorialStep, selectedEnemyIndex, selectedPlayerIndex, playerTeam, playerMana, tutorialRequiredMana, tutorial2InspectOpen, tutorial2InspectStep, tutorialElementalActionStep]);

  useEffect(() => {
    if (stage !== 'abilities') return;
    if (tutorial2InspectOpen) return;
    if (targetTutorialStep < 2 && selectedEnemyIndex === targetTutorialStep + 1) {
      setTargetTutorialStep(selectedEnemyIndex);
    } else if (targetTutorialStep === 2 && selectedPlayerIndex === 0) {
      onSelectPlayer?.(selectedPlayerIndex);
      setTargetTutorialStep(5);
    } else if (targetTutorialStep === 5 && playerMana >= tutorialRequiredMana) {
      setTargetTutorialStep(6);
    } else if (targetTutorialStep === 7 && tutorial2CastDone) {
      setTargetTutorialStep(8);
    }
  }, [stage, targetTutorialStep, selectedEnemyIndex, selectedPlayerIndex, playerMana, tutorialRequiredMana, tutorial2CastDone, onTutorial2Inspect, tutorial2InspectOpen]);

  // Handle MCQ selection success (Bước 3: Người chơi chọn đúng)
  useEffect(() => {
    if (stage === 1 && isStarted && mcqCorrectSelected && step < 4) {
      sound.playCorrect();
      setStep(3);
      setTargetRect(null);
      setPopupData({
        title: '🎉 Xin chúc mừng!',
        message: 'Chúc mừng! Starmon 1 của bạn sẽ được tấn công trong lượt này.',
        buttonText: 'Chuyển sang Phase 2 (Ghép ngọc Match-3) ➔',
        onAction: () => {
          sound.playClick();
          setPopupData(null);
          setStep(4);
          onAdvanceToMatch3?.();
        },
      });
    }
  }, [stage, isStarted, mcqCorrectSelected, step, onAdvanceToMatch3]);

  // Listen for orb swap completion (Bước 2 của Match-3)
  useEffect(() => {
    if (stage === 1 && isStarted && phase === 'phase2_combat' && tutorialRound === 1 && hasSwappedOrbs && step === 4) {
      sound.playRewardFanfare();
      setStep(5);
      setTargetRect(null);
      setPopupData({
        title: '🎉 Xin chúc mừng!',
        message: 'Chúc mừng! Bạn đã nắm vững cách tấn công đối thủ.',
        buttonText: 'Xem thanh HP đối thủ ➔',
        onAction: () => {
          sound.playClick();
          setPopupData(null);
          setStep(6);
        },
      });
    }
  }, [stage, isStarted, phase, tutorialRound, hasSwappedOrbs, step]);

  // Listen for IELTS speaking completion - let the user view the report scorecard modal
  useEffect(() => {
    if (stage === 1 && isStarted && ieltsAiResult && step >= 7 && step <= 9) {
      setStep(10);
      setTargetRect(null);
      setPopupData(null);
    }
  }, [stage, isStarted, ieltsAiResult, step]);

  // Return null on victory, defeat, or when IELTS AI evaluation report is displaying
  if ((phase === 'victory' || phase === 'defeat' || Boolean(ieltsAiResult)) && stage !== 'abilities') return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none select-none">
      {/* ========================================================================= */}
      {/* 0. INITIAL SCREEN: "TUTORIAL 1: Game mechanics" with START button beside & below */}
      {/* ========================================================================= */}
      {!isStarted && (
        <div className="fixed inset-0 z-50 pointer-events-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-slate-900 border-2 border-amber-400 rounded-3xl max-w-lg w-full shadow-2xl p-6 text-white flex flex-col gap-4">
            {/* Header: Title + Beside Start button */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h2 className="text-base md:text-lg font-black font-game text-white tracking-wide">
                  {stage === 'abilities' ? 'TUTORIAL 2: ABILITIES & TARGETS' : stage === 3 ? 'TUTORIAL 3: ELEMENTAL INTERACTIONS' : 'TUTORIAL 1: BATTLE BASIC'}
                </h2>
              </div>

              {/* Beside Start Button */}
              <button
                onClick={handleStartTutorial}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 text-slate-950 font-black font-game text-xs md:text-sm shadow-lg shadow-amber-400/30 cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Bắt đầu</span>
              </button>
            </div>

            {stage === 3 ? (
              <div className="space-y-2 text-xs md:text-sm text-slate-300">
                <p>Bài tập đưa một Starmon Water vào slot hoạt động: ghép Water orb đánh Fire Target, sau đó đánh Glidron để quan sát Counter và Resistance trong sát thương thật.</p>
                <p>Water orb tạo đòn Water cho mọi Starmon. Counter: +10%; Resistance: −10%. Same-element bonus được tính riêng.</p>
                <p>Fire orb/Fire DMG gây ít hơn 10% lên Water. Earth gây sát thương trung tính lên Wind/Electric vì Wind kháng Earth nhưng Electric lại yếu trước Earth.</p>
              </div>
            ) : stage === 'abilities' ? (
              <div className="space-y-2 text-xs md:text-sm text-slate-300"><p>Pointer sẽ chỉ vị trí cần thao tác trong từng bước.</p><p>1. Đổi mục tiêu Starmon 1 → 2 → 3.</p><p>2. Chọn Starmon 1 để đọc chỉ số và kỹ năng.</p><p>3. Ghép orb bất kỳ: mỗi orb cho 5 mana.</p><p>4. Dùng mana kích hoạt kỹ năng chủ động.</p></div>
            ) : <>
            {/* Description */}
            <div className="space-y-2 text-xs md:text-sm text-slate-300 leading-relaxed">
              <p>
                Chào mừng bạn đến với hướng dẫn cơ bản của <strong className="text-amber-300">Starmon IELTS Battle</strong>. Bạn sẽ làm quen với 3 phần chính trong trận đấu:
              </p>
              <ul className="space-y-1.5 text-xs text-slate-200 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                  <span><strong>Phase 1:</strong> Trả lời câu hỏi trắc nghiệm (MCQ) để mở khóa lượt tấn công.</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span><strong>Phase 2:</strong> Ghép ngọc trên bảng 8x8 để Starmon phóng đòn đánh và hạ gục HP đối thủ.</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                  <span><strong>Phase 3:</strong> Luyện nói IELTS Speaking từ 20-30s (đạt band ≥ 5.5 để tấn công kết liễu).</span>
                </li>
              </ul>
            </div>

            </>}
            {/* Below Start Button */}
            <button
              onClick={handleStartTutorial}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 text-slate-950 font-black font-game text-sm md:text-base shadow-xl shadow-amber-400/30 cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-slate-950" />
              <span>{stage === 3 ? 'BẮT ĐẦU TUTORIAL 3' : stage === 'abilities' ? 'BẮT ĐẦU TUTORIAL 2' : 'BẮT ĐẦU HƯỚNG DẪN 1'}</span>
            </button>
            <button
              onClick={() => {
                sound.playClick();
                onSkip?.();
              }}
              className="w-full py-2 rounded-xl border border-slate-600 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs cursor-pointer transition-colors"
            >
              Tôi đã biết rồi! Bỏ qua hướng dẫn
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. GLOBAL SPOTLIGHT SVG MASK (Darkened Overlay with cutout for highlighted element) */}
      {/* Không còn hiệu ứng tối mờ sau khi người chơi trả lời speaking ở Tutorial 1 */}
      {/* ========================================================================= */}
      {isStarted && !(stage === 'abilities' && (targetTutorialStep > 2 || tutorial2InspectOpen)) && !(stage === 1 && (step >= 9 || hasRecordedSpeaking || Boolean(ieltsAiResult) || tutorialRound === 2)) && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <mask id="tutorial-spotlight-mask">
              {/* White covers entire screen (overlay visible) */}
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {/* Black cuts out the spotlight hole for interaction */}
              {targetRect && (
                <rect
                  x={targetRect.x}
                  y={targetRect.y}
                  width={targetRect.width}
                  height={targetRect.height}
                  rx="18"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          {/* Dark mask overlay (82% opacity) */}
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(10, 15, 30, 0.85)"
            mask="url(#tutorial-spotlight-mask)"
          />
          {/* Pulsing glowing border framing the active element */}
          {targetRect && (
            <rect
              x={targetRect.x}
              y={targetRect.y}
              width={targetRect.width}
              height={targetRect.height}
              rx="18"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="3.5"
              strokeDasharray="8 6"
              className="animate-pulse"
            />
          )}
        </svg>
      )}

      {/* Crisp Golden Frame when dark mask is disabled after speaking in Tutorial 1 */}
      {isStarted && targetRect && (tutorial2InspectOpen || (stage === 1 && (step >= 9 || hasRecordedSpeaking || Boolean(ieltsAiResult) || tutorialRound === 2))) && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-40">
          <rect
            x={targetRect.x}
            y={targetRect.y}
            width={targetRect.width}
            height={targetRect.height}
            rx="18"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="3.5"
            strokeDasharray="8 6"
            className="animate-pulse"
          />
        </svg>
      )}

      {/* ========================================================================= */}
      {/* 2. ANIMATED GUIDE HAND POINTER */}
      {/* ========================================================================= */}
      {isStarted && targetRect && !popupData && (
        <div
          className="absolute z-50 pointer-events-none transition-all duration-500 ease-out"
          style={{
            left: `${handPos.x}px`,
            top: `${handPos.y}px`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* Pulsing beacon glow ring */}
          <div className="absolute -inset-4 rounded-full bg-amber-400/30 animate-ping" />
          <div className="relative flex items-center justify-center">
            {/* Hand Pointer Emoji with directional rotation and bouncing animation */}
            <div
              className="text-4xl md:text-5xl filter drop-shadow-[0_4px_12px_rgba(251,191,36,0.9)] animate-bounce select-none"
              style={{
                transform: `rotate(${handPos.angle}deg)`,
              }}
            >
              👉
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MODAL POPUP FOR SPECIFIC STEP COMPLETIONS (Steps 3, 5, 9) */}
      {/* ========================================================================= */}
      {isStarted && popupData && (
        <div className="fixed inset-0 z-50 pointer-events-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-slate-900 border-2 border-amber-400 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl text-white flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-300">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="text-lg font-black font-game text-amber-300">
              {popupData.title}
            </h3>
            <p className="text-xs md:text-sm text-slate-200 leading-relaxed font-bold">
              {popupData.message}
            </p>
            <button
              onClick={popupData.onAction}
              className="mt-2 w-full py-3 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 text-slate-950 font-black font-game text-xs md:text-sm rounded-xl shadow-lg cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 transition-all"
            >
              <span>{popupData.buttonText}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. FLOATING INSTRUCTION DIALOGUE TEXT BOX */}
      {/* ========================================================================= */}
      {isStarted && !popupData && targetRect && !tutorial2InspectOpen && (
        <div
          className="absolute z-50 pointer-events-auto transition-all duration-300"
          style={{
            left: (step === 4 || step === 10)
              ? (() => {
                  const el = document.getElementById('tutorial-player-starmon-0');
                  if (el) {
                    const r = el.getBoundingClientRect();
                    return Math.max(16, r.left);
                  }
                  return 20;
                })()
              : step === 6
              ? '50%'
              : targetRect
              ? Math.min(
                  window.innerWidth - 340,
                  Math.max(20, targetRect.x + targetRect.width / 2 - 160)
                )
              : '50%',
            top: stage === 3 && step === 7
              ? 72
              : (step === 4 || step === 10)
              ? (() => {
                  const el = document.getElementById('tutorial-player-starmon-0');
                  if (el) {
                    const r = el.getBoundingClientRect();
                    return Math.max(16, r.top - 135);
                  }
                  return 16;
                })()
              : step === 6
              ? 16
              : step === 2
              ? (targetRect
                  ? Math.max(8, (targetRect.y > 200 ? targetRect.y - 130 : targetRect.y + targetRect.height + 20) - 76)
                  : 'calc(30% - 76px)')
              : targetRect
              ? targetRect.y > 200
                ? Math.max(16, targetRect.y - 130)
                : Math.min(window.innerHeight - 150, targetRect.y + targetRect.height + 20)
              : '30%',
            transform: step === 6 ? 'translateX(-50%)' : (step === 4 || step === 10 || (stage === 3 && step === 7)) ? 'none' : targetRect ? 'none' : 'translate(-50%, -50%)',
            width: '320px',
            maxHeight: 'calc(100vh - 88px)',
            overflowY: 'auto',
          }}
        >
          <div className="bg-slate-900/95 border-2 border-amber-400 rounded-2xl p-4 shadow-2xl backdrop-blur-md text-white flex flex-col gap-2.5 relative">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <div className="flex items-center gap-1.5 text-amber-300 text-xs font-black font-game uppercase tracking-wide">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{stage === 'abilities' ? 'TUTORIAL 2: ABILITIES & TARGETS' : stage === 3 ? 'TUTORIAL 3: ELEMENTAL INTERACTIONS' : 'HƯỚNG DẪN 1: Cơ chế trò chơi'}</span>
              </div>
            </div>

            {/* Core Instruction Text */}
            <p className="text-xs md:text-sm text-amber-100 font-bold leading-relaxed whitespace-pre-line">
              {instructionText}
            </p>

            {/* Actions for Step 1 ("Tôi đã hiểu!") & Step 6 ("Tiếp tục") */}
            <div className="flex items-center justify-between pt-1 gap-2">
              <div className="text-[10px] text-slate-400 font-mono">
                {stage === 3 && `Bước ${step} / 7`}
                {stage === 'abilities' && `Bước ${Math.min(targetTutorialStep + 1, 9)} / 9`}
                {stage === 1 && step <= 3 && '🎯 Phase 1: Trắc nghiệm (MCQ)'}
                {stage === 1 && step >= 4 && step <= 6 && '⚔️ Phase 2: Ghép ngọc 8x8'}
                {stage === 1 && step >= 7 && step <= 9 && '🎙️ Phase 3: Luyện nói IELTS'}
                {stage === 1 && step >= 10 && '⚔️ Đòn đánh kết liễu'}
              </div>

              {/* Step 1: Button "Tôi đã hiểu!" */}
              {step === 1 && stage !== 3 && (
                <button
                  onClick={handleUnderstandStep1}
                  className="px-3 py-1.5 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 text-slate-950 font-black text-xs rounded-xl shadow cursor-pointer active:scale-95 flex items-center gap-1 transition-all"
                >
                  <span>Tôi đã hiểu!</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}

              {stage === 3 && [1, 2, 3, 5, 7].includes(step) && (
                <button onClick={advanceElementalTutorial} className="px-3 py-1.5 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 text-slate-950 font-black text-xs rounded-xl shadow cursor-pointer active:scale-95 flex items-center gap-1 transition-all">
                  <span>{step === 7 ? 'Hoàn tất' : step === 3 ? 'Chọn Fire Target' : step === 5 ? 'Chọn Glidron' : 'Tiếp tục'}</span><ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Step 6: Button "Tiếp tục (Luyện nói IELTS)" */}
              {step === 6 && stage === 1 && (
                <button
                  onClick={() => {
                    sound.playClick();
                    onAdvanceToSpeaking?.();
                  }}
                  className="px-3 py-1.5 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 text-slate-950 font-black text-xs rounded-xl shadow cursor-pointer active:scale-95 flex items-center gap-1 transition-all"
                >
                  <span>Tiếp tục (Luyện nói IELTS)</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
              {stage === 'abilities' && targetTutorialStep === 6 && playerMana >= tutorialRequiredMana && (
                <button
                  onClick={() => {
                    sound.playClick();
                    setTargetTutorialStep(7);
                  }}
                  className="px-3 py-1.5 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 text-slate-950 font-black text-xs rounded-xl shadow cursor-pointer active:scale-95 flex items-center gap-1 transition-all"
                >
                  <span>Tôi đã hiểu!</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isStarted && tutorial2InspectOpen && targetRect && (
        <div
          className="fixed z-[60] pointer-events-auto w-[220px] max-w-[calc(100vw-2rem)] rounded-2xl border-2 border-amber-400 bg-slate-900/95 p-3.5 text-white shadow-2xl backdrop-blur-md"
          style={{
            left: Math.max(12, Math.min(window.innerWidth - 232, targetRect.x - 236)),
            top: Math.max(12, Math.min(window.innerHeight - 128, targetRect.y + targetRect.height / 2 - 56)),
          }}
        >
          <div className="mb-2 flex items-center gap-1.5 border-b border-slate-700 pb-1.5 text-[10px] font-black uppercase tracking-wide text-amber-300">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Tutorial 2 · Xem Starmon</span>
          </div>
          <p className="text-xs font-bold leading-relaxed text-amber-100">
            {[
              'Đây là chỉ số gốc của Starmon.',
              'Đây là Thanh Sinh Lực (HP) và Thanh Năng Lượng (Mana) hiện tại của Starmon.',
              'Đây là Nội Tại (Passive) của Starmon. Kỹ năng này tự động kích hoạt trong trận đấu.',
              'Đây là Chiêu Kích Hoạt (Abilities). Ấn dấu mũi tên để dùng chiêu; chiêu tốn mana và Starmon sẽ mất lượt ghép orb.',
              'Ấn CLOSE để đóng bảng thông tin và quay lại trận đấu.',
            ][Math.min(4, Math.max(0, tutorial2InspectStep))]}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[9px] font-mono text-slate-400">Bước {tutorial2InspectStep + 1} / 5</span>
            {tutorial2InspectStep < 4 && (
              <button
                onClick={() => {
                  sound.playClick();
                  onTutorial2InspectNext?.();
                }}
                className="rounded-lg bg-gradient-to-r from-amber-400 to-yellow-400 px-2.5 py-1.5 text-[10px] font-black text-slate-950 active:scale-95"
              >
                Tôi đã hiểu <ChevronRight className="ml-0.5 inline h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
