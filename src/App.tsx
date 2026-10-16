import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PlayerProfile, Starmon, QuestItem, ChatMessage, ChatChannel, ElementType, ResearchJob, SpeakingLogEntry, MysteryReward } from './types';
import { STARMON_ROSTER } from './data/starmons';
import { getStarmonClass, getStatsForLevel, calculateCP } from './data/starmonStats';
import { INITIAL_QUESTS } from './data/questsData';
import { INITIAL_CHAT_MESSAGES } from './data/chatData';
import { MainHub } from './components/MainHub';
import { BeginnerPackModal } from './components/BeginnerPackModal';
import { ElementalPackModal } from './components/ElementalPackModal';
import { StarmonManagement } from './components/StarmonManagement';
import { BattleView } from './components/BattleView';
import { SettingsModal } from './components/SettingsModal';
import { ShopModal } from './components/ShopModal';
import { MailModal } from './components/MailModal';
import { MicrophonePermissionModal } from './components/MicrophonePermissionModal';
import { AuthAndSaveModal, getCurrentUsername, saveAccount, getAllAccounts, syncAccountsFromServer } from './components/AuthAndSaveModal';
import { QuestModal } from './components/QuestModal';
import { InventoryModal } from './components/InventoryModal';
import { EnergyBatteryModal } from './components/EnergyBatteryModal';
import { ChatModal } from './components/ChatModal';
import { TutorialModal } from './components/TutorialModal';
import { OnboardingSpotlight } from './components/OnboardingSpotlight';
import { sound } from './services/sound';
import { getEquipmentUpgradeCost, getItemLevelStats, ITEM_CRAFT_COST } from './data/itemStats';
import { EQUIPMENT_ITEMS_CATALOG } from './data/itemsData';
import { EventsModal } from './components/EventsModal';
import { getDailyRewardStatus } from './data/dailyRewards';
import { testFirestoreConnection, resetAccountInFirestore } from './services/firebase';
import { getResearchLevel, getUnlockedItemSlots, RESEARCH_NODES, ResearchNodeId, isResearchNodeUnlocked, getResearchStatBonuses } from './data/techResearch';

const STORAGE_KEY = 'starmon_game_save_v4'; // v4: Quests start strictly at 0, chat empty at start, new epic quests, 2 starter packs, 0 Starmon

export default function App() {
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // INITIAL STATE: Starts strictly with 2 Starter Packs and 0 Starmon in inventory!
  const [player, setPlayer] = useState<PlayerProfile>(() => {
    let savedGoogleId = '';
    try {
      savedGoogleId = localStorage.getItem('starmon_pvp_uid') || localStorage.getItem('starmon_google_id') || '';
    } catch {}
    if (!savedGoogleId) {
      savedGoogleId = `google_${Math.random().toString(36).substring(2, 9)}`;
      try {
        localStorage.setItem('starmon_pvp_uid', savedGoogleId);
        localStorage.setItem('starmon_google_id', savedGoogleId);
      } catch {}
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY + '_player');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          quizQuestionMode: parsed.quizQuestionMode === 'part1_preference' ? 'part1_preference' : 'random',
          speakingLog: Array.isArray(parsed.speakingLog) ? parsed.speakingLog : [],
          googleId: parsed.googleId || savedGoogleId,
          googleEmail: parsed.googleEmail || '',
          royalTokens: parsed.royalTokens || 0,
          omniStarmonCards: parsed.omniStarmonCards || 0,
          commonItemPacks: parsed.commonItemPacks || 0,
          energy: parsed.energy !== undefined ? parsed.energy : 100,
          maxEnergy: 100,
          lastEnergyRegenTime: parsed.lastEnergyRegenTime || Date.now(),
          energyBatteries: {
            battery50: parsed.energyBatteries?.battery50 !== undefined ? parsed.energyBatteries.battery50 : 5,
            battery100: parsed.energyBatteries?.battery100 !== undefined ? parsed.energyBatteries.battery100 : 3,
            battery200: parsed.energyBatteries?.battery200 !== undefined ? parsed.energyBatteries.battery200 : 1,
          },
          specialItems: {
            starShard: parsed.specialItems?.starShard !== undefined ? parsed.specialItems.starShard : 15,
            goldenAnvil: parsed.specialItems?.goldenAnvil !== undefined ? parsed.specialItems.goldenAnvil : 5,
          },
          equipmentInventory: parsed.equipmentInventory || [],
          craftingJobs: parsed.craftingJobs || [],
          techResearchLevels: parsed.techResearchLevels || {},
          researchJobs: parsed.researchJobs || [],
          claimedAquanymphDaPhucPack: parsed.claimedAquanymphDaPhucPack || false,
        };
      }
    } catch {}
    const initialUser = getCurrentUsername() || 'Player';
    return {
      name: initialUser,
      username: initialUser,
      googleId: savedGoogleId,
      googleEmail: '',
      level: 1,      // Starts strictly at Level 1
      exp: 0,
      nextExp: 100,
      gold: 0,       // Starts strictly at 0 Gold
      gems: 0,       // Starts strictly at 0 Gems
      royalTokens: 0,
      omniStarmonCards: 0,
      commonItemPacks: 0,
      energy: 100,   // Base energy 100/100, regens 1 per 10 mins, stops at 100
      maxEnergy: 100,
      lastEnergyRegenTime: Date.now(),
      energyBatteries: {
        battery50: 5,
        battery100: 3,
        battery200: 1,
      },
      specialItems: {
        starShard: 15,
        goldenAnvil: 5,
      },
      starterPacksCount: 2, // Starts strictly with 2 Starter Packs!
      isNewPlayer: true,
      hasClaimedBeginnerPack: false,
      hasCompletedOnboardingTutorial: false,
      hasClaimedTutorial1Reward: false,
      completedTutorialStages: [],
      activeCompanionId: '', // Starts strictly with 0 Starmon in inventory!
      battleParty: [], // Battle Party lineup (1 to 3 Starmons)
      equipmentInventory: [],
      craftingJobs: [],
      techResearchLevels: {},
      researchJobs: [],
      elementalPacks: { Wind: 0, Water: 0, Metal: 0, Fire: 0, Electric: 0, Earth: 0 },
      claimedAquanymphDaPhucPack: false,
      mailUnreadCount: 0, // Starts at 0 (only shows red badge when real unread mail exists)
      soundEnabled: true,
      musicEnabled: true,
      showSpeakingHints: false, // Speaking hints hidden by default, can be enabled in settings
      quizQuestionMode: 'random',
      speakingLog: [],
      graphicsQuality: 'High',
    };
  });

  const [starmons, setStarmons] = useState<Starmon[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY + '_starmons');
      if (saved) {
        const parsed: Starmon[] = JSON.parse(saved);
        const savedMap = new Map(parsed.map(s => [s.id, s]));
        const legacyDaPhuc = savedMap.get('aquanymph_daphuc');

        return STARMON_ROSTER.map(rosterMon => {
          let userMon = savedMap.get(rosterMon.id);
          // If rosterMon is aquanymph, merge any legacy aquanymph_daphuc saved data into it
          if (rosterMon.id === 'aquanymph' && legacyDaPhuc) {
            userMon = {
              ...(userMon || rosterMon),
              unlocked: (userMon && userMon.unlocked) || !!legacyDaPhuc.unlocked,
              cards: Math.max(userMon?.cards || 0, legacyDaPhuc.cards || 0),
              level: Math.max(userMon?.level || 1, legacyDaPhuc.level || 1),
            };
          }

          const defaultUnlockedSlots = rosterMon.unlockedSlots || [false, false, false, false, false, false];
          const defaultEquipped = rosterMon.equippedItems || [null, null, null, null, null, null];
          if (userMon) {
            const level = userMon.level || 1;
            const starmonClass = getStarmonClass(rosterMon.id);
            const levelStats = starmonClass ? getStatsForLevel(starmonClass, level) : undefined;
            const equippedItems = userMon.equippedItems || defaultEquipped;
            const hasDaPhucUniform = rosterMon.id === 'aquanymph' && equippedItems.includes('da_phuc_uniform');
            const unlockedSlots = userMon.unlockedSlots || defaultUnlockedSlots;
            if (rosterMon.id === 'aquanymph' && hasDaPhucUniform) {
              unlockedSlots[0] = true;
            }

            return {
              ...rosterMon,
              unlocked: !!userMon.unlocked,
              cards: userMon.cards || 0,
              level,
              starmonClass: starmonClass || undefined,
              maxHp: levelStats?.hp ?? rosterMon.maxHp,
              currentHp: levelStats?.hp ?? rosterMon.maxHp,
              baseAtk: levelStats?.atk ?? rosterMon.baseAtk,
              def: levelStats?.def ?? rosterMon.def,
              cp: levelStats?.cp ?? calculateCP(rosterMon.maxHp, rosterMon.baseAtk, rosterMon.def),
              name: hasDaPhucUniform ? 'Aquanymph Đa Phúc' : (userMon.name && userMon.name !== 'Aquanymph Đa Phúc' ? userMon.name : rosterMon.name),
              title: hasDaPhucUniform ? 'Phiên Bản Độc Quyền Đa Phúc' : rosterMon.title,
              avatarSeed: hasDaPhucUniform ? 'aquanymph_dp' : rosterMon.avatarSeed,
              isDaPhucVersion: hasDaPhucUniform,
              unlockedSlots,
              equippedItems,
            };
          }
          return {
            ...rosterMon,
            unlocked: false,
            cards: 0,
            level: 1,
            unlockedSlots: defaultUnlockedSlots,
            equippedItems: defaultEquipped,
          };
        });
      }
    } catch {}
    // All Starmons start locked with 0 cards as specifically requested!
    return STARMON_ROSTER.map(s => ({
      ...s,
      unlocked: false,
      cards: 0,
      level: 1,
      unlockedSlots: s.unlockedSlots || [false, false, false, false, false, false],
      equippedItems: s.equippedItems || [null, null, null, null, null, null],
    }));
  });

  // Prompt for microphone permission on EVERY game access / visit
  const [showMicModal, setShowMicModal] = useState<boolean>(true);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);

  const requestMicrophoneAccess = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        setHasMicPermission(true);
      }
    } catch (err) {
      console.warn('Microphone permission request:', err);
      setHasMicPermission(false);
    }
  };

  // Modal / Screen Navigation States
  const [activeScreen, setActiveScreen] = useState<'hub' | 'battle' | 'inventory'>('hub');
  const [activePvpRoom, setActivePvpRoom] = useState<{
    code: string;
    hostName: string;
    hostId?: string;
    arena: string;
    myPlayerId?: string;
    myPlayerName?: string;
    isHost?: boolean;
    opponentId?: string;
    opponentName?: string;
    opponentStarmons?: Starmon[];
  } | null>(null);
  const [showPackModal, setShowPackModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showShopModal, setShowShopModal] = useState(false);
  const [showMailModal, setShowMailModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showQuestModal, setShowQuestModal] = useState(false);
  const [showEventsModal, setShowEventsModal] = useState(false);
  const dailyRewardClaimsInFlight = useRef(new Set<string>());
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [showEnergyBatteryModal, setShowEnergyBatteryModal] = useState(false);
  const [openingElementalPack, setOpeningElementalPack] = useState<ElementType | null>(null);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showTutorialModal, setShowTutorialModal] = useState<boolean>(false);
  const [activeTutorialStage, setActiveTutorialStage] = useState<1 | 2 | 3 | null>(null);
  const [authInitialTab, setAuthInitialTab] = useState<'profile' | 'auth' | 'backup' | 'restore' | 'password'>('profile');

  // Passive Energy Regeneration: 1 Energy unit per 10 minutes (600,000 ms), stops naturally at 100
  useEffect(() => {
    const checkEnergyRegen = () => {
      setPlayer(prev => {
        if (prev.energy >= 100) {
          return {
            ...prev,
            lastEnergyRegenTime: Date.now(),
          };
        }
        const lastRegen = prev.lastEnergyRegenTime || Date.now();
        const elapsed = Date.now() - lastRegen;
        const cycle = 10 * 60 * 1000;
        if (elapsed >= cycle) {
          const pointsGained = Math.floor(elapsed / cycle);
          const newEnergy = Math.min(100, prev.energy + pointsGained);
          const nextCycleTime = lastRegen + pointsGained * cycle;
          return {
            ...prev,
            energy: newEnergy,
            lastEnergyRegenTime: newEnergy >= 100 ? Date.now() : nextCycleTime,
          };
        }
        return prev;
      });
    };

    checkEnergyRegen();
    const interval = setInterval(checkEnergyRegen, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleUseBatteries = (tier: 50 | 100 | 200, count: number) => {
    setPlayer(prev => {
      const key = tier === 50 ? 'battery50' : tier === 100 ? 'battery100' : 'battery200';
      const available = prev.energyBatteries?.[key] || 0;
      const countToUse = Math.min(count, available);
      if (countToUse <= 0) return prev;

      const energyGain = countToUse * tier;
      const updatedBatteries = {
        ...(prev.energyBatteries || { battery50: 0, battery100: 0, battery200: 0 }),
        [key]: available - countToUse,
      };

      const newEnergy = prev.energy + energyGain;

      return {
        ...prev,
        energy: newEnergy,
        energyBatteries: updatedBatteries,
        lastEnergyRegenTime: newEnergy >= 100 ? Date.now() : prev.lastEnergyRegenTime,
      };
    });
  };

  const handleTutorial1Reward = () => {
    if (player.hasClaimedTutorial1Reward) return;
    setPlayer(prev => ({
      ...prev,
      gold: prev.gold + 1000,
      hasClaimedTutorial1Reward: true,
      completedTutorialStages: Array.from(new Set([...(prev.completedTutorialStages || []), 1])),
    }));
  };

  const handleStartTutorialMatch = (stage: 1 | 2 | 3) => {
    sound.playClick();
    setActiveTutorialStage(stage);
    setShowTutorialModal(false);
    setShowSettingsModal(false);
    setActivePvpRoom(null);
    setActiveScreen('battle');
  };

  const handleOnboardingStartTutorial = () => {
    sound.playClick();
    setPlayer(prev => ({
      ...prev,
      hasCompletedOnboardingTutorial: true,
    }));
    handleStartTutorialMatch(1);
  };

  // Quests & Chat Persistent State - Scoped to current account
  const [quests, setQuests] = useState<QuestItem[]>(() => {
    const mergeWithInitial = (loaded: QuestItem[]): QuestItem[] => {
      const loadedMap = new Map(loaded.map(q => [q.id, q]));
      return INITIAL_QUESTS.map(iq => {
        const existing = loadedMap.get(iq.id);
        if (existing) {
          return {
            ...iq,
            currentProgress: existing.currentProgress || 0,
            claimed: !!existing.claimed,
          };
        }
        return { ...iq, currentProgress: 0, claimed: false };
      });
    };

    try {
      const u = (getCurrentUsername() || 'Player').toLowerCase();
      const accounts = getAllAccounts();
      if (accounts[u]?.quests && accounts[u].quests.length > 0) {
        return mergeWithInitial(accounts[u].quests);
      }
      const accountSaved = localStorage.getItem(`${STORAGE_KEY}_quests_${u}`);
      if (accountSaved) return mergeWithInitial(JSON.parse(accountSaved));
      const saved = localStorage.getItem(STORAGE_KEY + '_quests');
      if (saved) return mergeWithInitial(JSON.parse(saved));
    } catch {}
    return INITIAL_QUESTS.map(q => ({ ...q, currentProgress: 0, claimed: false }));
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY + '_chat');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_CHAT_MESSAGES;
  });

  // Central Server & Firebase Cloud Firestore Account Synchronization on mount
  useEffect(() => {
    testFirestoreConnection().catch(() => {});
    if (sessionStorage.getItem('starmon_just_reset') === 'true') {
      sessionStorage.removeItem('starmon_just_reset');
      return;
    }
    syncAccountsFromServer().then(async () => {
      const currentGid = localStorage.getItem('starmon_pvp_uid') || localStorage.getItem('starmon_google_id') || player.googleId;
      const currentUname = player.username || getCurrentUsername();
      const targetSearch = currentGid || currentUname;

      if (targetSearch && targetSearch !== 'Guest Adventurer' && targetSearch !== 'Player') {
        try {
          const res = await fetch(`/api/accounts/${encodeURIComponent(targetSearch)}`);
          if (res.ok) {
            const acc = await res.json();
            if (acc && acc.player) {
              setPlayer(prev => ({
                ...acc.player,
                googleId: acc.googleId || prev.googleId,
                googleEmail: acc.email || prev.googleEmail,
              }));
              if (acc.starmons && acc.starmons.length > 0) {
                setStarmons(acc.starmons);
              }
              if (acc.quests && acc.quests.length > 0) {
                setQuests(acc.quests);
              }
            }
          }
        } catch {}
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const u = (player.username || getCurrentUsername() || 'Player').toLowerCase();
      localStorage.setItem(`${STORAGE_KEY}_quests_${u}`, JSON.stringify(quests));
      localStorage.setItem(STORAGE_KEY + '_quests', JSON.stringify(quests));
      if (u && u !== 'guest adventurer' && (u !== 'player' || player.googleId)) {
        const canonicalKey = (player.googleId || player.googleEmail || u).toLowerCase();
        const accounts = getAllAccounts();
        const existing = accounts[canonicalKey] || accounts[u];
        const updatedAcc = {
          username: player.username || u,
          googleId: player.googleId || '',
          email: player.googleEmail || '',
          createdAt: existing?.createdAt || new Date().toISOString(),
          lastPlayedAt: new Date().toISOString(),
          quests,
          player,
          starmons,
        };
        saveAccount(updatedAcc);
      }
    } catch {}
  }, [quests, player, starmons]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY + '_chat', JSON.stringify(chatMessages));
    } catch {}
  }, [chatMessages]);

  const handleClaimQuest = (quest: QuestItem) => {
    sound.playRewardFanfare();
    setQuests(prev =>
      prev.map(q => (q.id === quest.id ? { ...q, claimed: true } : q))
    );

    setPlayer(prev => {
      let nextGold = prev.gold;
      let nextGems = prev.gems;
      let nextPacks = prev.starterPacksCount;

      if (quest.rewardType === 'gold') nextGold += quest.rewardAmount;
      if (quest.rewardType === 'gems') nextGems += quest.rewardAmount;
      if (quest.rewardType === 'pack') nextPacks += quest.rewardAmount;

      return {
        ...prev,
        gold: nextGold,
        gems: nextGems,
        starterPacksCount: nextPacks,
      };
    });

    if (quest.rewardType === 'cards') {
      setStarmons(prev => {
        const unlocked = prev.filter(s => s.unlocked);
        if (unlocked.length > 0) {
          const target = unlocked[0];
          return prev.map(s => (s.id === target.id ? { ...s, cards: s.cards + quest.rewardAmount } : s));
        }
        return prev;
      });
    }
  };

  const handleClaimDailyReward = (day: number, mysteryReward?: MysteryReward) => {
    const status = getDailyRewardStatus(player.dailyRewardProgress, new Date());
    if (day !== status.day || !status.canClaimToday) return { success: false, message: 'This reward is not available today.' };
    const claimKey = `${player.username || player.name}:${status.cycleStartedOn}:${day}`;
    if (dailyRewardClaimsInFlight.current.has(claimKey)) return { success: false, message: 'This daily reward has already been claimed.' };
    const owned = starmons.filter(mon => mon.unlocked);
    if (day === 3 && owned.length === 0) return { success: false, message: 'Unlock a Starmon before claiming Day 3.' };
    if (day === 7 && !mysteryReward) return { success: false, message: 'Spin the chest to claim Day 7.' };
    dailyRewardClaimsInFlight.current.add(claimKey);
    const cardTarget = day === 3 ? owned[Math.floor(Math.random() * owned.length)] : undefined;
    const rewardText = day === 3 ? `20 ${cardTarget?.name} Cards` : day === 7 ? 'Mystery Chest reward claimed!' : 'Daily reward claimed!';
    setPlayer(prev => {
      const current = getDailyRewardStatus(prev.dailyRewardProgress, new Date());
      if (day !== current.day || !current.canClaimToday) return prev;
      const next: PlayerProfile = {
        ...prev,
        dailyRewardProgress: {
          cycleStartedOn: current.cycleStartedOn,
          claimedDays: [...current.claimedDays, day],
          lastClaimedOn: current.today,
          ...(cardTarget ? { cardRewardStarmonId: cardTarget.id } : {}),
        },
      };
      if (day === 1) next.gold += 500;
      if (day === 2) next.gems += 20;
      if (day === 4) next.gold += 800;
      if (day === 5) next.omniStarmonCards = (prev.omniStarmonCards || 0) + 10;
      if (day === 6) next.gems += 40;
      if (mysteryReward) {
        if (mysteryReward.type === 'elementalPack') next.elementalPacks = { ...prev.elementalPacks, [mysteryReward.element]: (prev.elementalPacks?.[mysteryReward.element] || 0) + 1 };
        if (mysteryReward.type === 'gems') next.gems += mysteryReward.amount;
        if (mysteryReward.type === 'gold') next.gold += mysteryReward.amount;
        if (mysteryReward.type === 'goldenAnvil') next.specialItems = { ...(prev.specialItems || { starShard: 0, goldenAnvil: 0 }), goldenAnvil: (prev.specialItems?.goldenAnvil || 0) + 1 };
        if (mysteryReward.type === 'commonItemPack') next.commonItemPacks = (prev.commonItemPacks || 0) + 1;
        if (mysteryReward.type === 'starShard') next.specialItems = { ...(prev.specialItems || { starShard: 0, goldenAnvil: 0 }), starShard: (prev.specialItems?.starShard || 0) + mysteryReward.amount };
        if (mysteryReward.type === 'omniCards') next.omniStarmonCards = (prev.omniStarmonCards || 0) + mysteryReward.amount;
      }
      return next;
    });
    if (cardTarget) setStarmons(prev => prev.map(mon => mon.id === cardTarget.id ? { ...mon, cards: mon.cards + 20 } : mon));
    return { success: true, message: rewardText };
  };

  const handleConvertOmniCards = (starmonId: string, count: number) => {
    const amount = Math.floor(count);
    if (amount < 1 || amount > (player.omniStarmonCards || 0) || !starmons.some(mon => mon.id === starmonId && mon.unlocked)) return;
    setPlayer(prev => ({ ...prev, omniStarmonCards: Math.max(0, (prev.omniStarmonCards || 0) - amount) }));
    setStarmons(prev => prev.map(mon => mon.id === starmonId ? { ...mon, cards: mon.cards + amount } : mon));
  };

  const handleOpenCommonItemPack = () => {
    if ((player.commonItemPacks || 0) < 1) return 'No Common Item Packs available.';
    const commonItems = Object.values(EQUIPMENT_ITEMS_CATALOG).filter(item => item.rarity === 'common' && item.slotType !== 'special');
    const givesShards = Math.random() < 0.2 || commonItems.length === 0;
    setPlayer(prev => ({ ...prev, commonItemPacks: Math.max(0, (prev.commonItemPacks || 0) - 1), ...(givesShards ? { specialItems: { ...(prev.specialItems || { starShard: 0, goldenAnvil: 0 }), starShard: (prev.specialItems?.starShard || 0) + 30 } } : {}) }));
    if (givesShards) return 'Common Item Pack opened: 30 Star Shards!';
    const item = commonItems[Math.floor(Math.random() * commonItems.length)];
    setPlayer(prev => ({ ...prev, equipmentInventory: [...(prev.equipmentInventory || []), { itemId: item.id, count: 1, level: 1 }] }));
    return `Common Item Pack opened: ${item.name}!`;
  };

  const handleSendChatMessage = (channel: ChatChannel, text: string) => {
    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random()}`,
      channel,
      senderName: player.username || player.name || 'Trainer',
      senderBadge: `Lv. ${player.level}`,
      message: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSelf: true,
    };
    setChatMessages(prev => [...prev, newMsg]);

    if (channel === 'world') {
      setTimeout(() => {
        const replies = [
          'Awesome answer! Keep training your IELTS speaking fluency.',
          'Great strategy! Have you tried matching 5 elemental orbs yet?',
          'Good luck in your next battle, Trainer!',
        ];
        const botReply: ChatMessage = {
          id: `reply_${Date.now()}`,
          channel: 'world',
          senderName: 'Elena_IELTS_Pro',
          senderBadge: 'Band 8.0',
          message: replies[Math.floor(Math.random() * replies.length)],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setChatMessages(curr => [...curr, botReply]);
      }, 2200);
    }
  };

  // Save to localStorage & active account database
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY + '_player', JSON.stringify(player));
    } catch {}
  }, [player]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY + '_starmons', JSON.stringify(starmons));
    } catch {}
  }, [starmons]);

  // Keep user account synchronized in accounts storage
  useEffect(() => {
    if (player.username && player.username !== 'Guest Adventurer') {
      saveAccount({
        username: player.username,
        createdAt: new Date().toISOString(),
        lastPlayedAt: new Date().toISOString(),
        player,
        starmons,
      });
    }
  }, [player, starmons]);

  // Active Companion Starmon (null if 0 Starmon in inventory)
  const activeStarmon = starmons.find(s => s.id === player.activeCompanionId && s.unlocked) || starmons.find(s => s.unlocked);
  const unlockedCount = starmons.filter(s => s.unlocked).length;

  // ==========================================
  // HANDLERS
  // ==========================================

  // Claim Starter Pack (supports opening 2 packs)
  const handleClaimStarterPack = (
    starterStarmon: Starmon,
    goldAmount: number,
    cardsAmount: number,
    openNext: boolean = false
  ) => {
    const nextPacks = Math.max(0, player.starterPacksCount - 1);

    if (!openNext) {
      setShowPackModal(false);
      setShowMailModal(false);
    }

    // Unlock the won Starter Starmon and add cards specifically for this Starmon!
    setStarmons(prev =>
      prev.map(s => {
        if (s.id === starterStarmon.id) {
          return {
            ...s,
            unlocked: true,
            cards: s.cards + cardsAmount,
          };
        }
        return s;
      })
    );

    // Update Player Profile: grant Gold, update packs count, and set as active companion & party member
    setPlayer(prev => {
      const willHaveNoPacksLeft = nextPacks <= 0;
      const currentParty = prev.battleParty || [];
      const updatedParty = currentParty.includes(starterStarmon.id)
        ? currentParty
        : (currentParty.length < 3 ? [...currentParty, starterStarmon.id] : currentParty);
      return {
        ...prev,
        gold: prev.gold + goldAmount,
        starterPacksCount: nextPacks,
        isNewPlayer: false,
        hasClaimedBeginnerPack: willHaveNoPacksLeft,
        mailUnreadCount: willHaveNoPacksLeft ? 0 : prev.mailUnreadCount,
        activeCompanionId: prev.activeCompanionId || starterStarmon.id,
        battleParty: updatedParty,
      };
    });
  };

  // Purchase an Elemental Pack from the Shop (359 Gems) -> Transferred to Inventory > Consumables
  const handlePurchaseElementalPack = (element: ElementType) => {
    setPlayer(prev => {
      const nextGems = Math.max(0, prev.gems - 359);
      const currentPacks = { ...(prev.elementalPacks || {}) };
      currentPacks[element] = (currentPacks[element] || 0) + 1;

      return {
        ...prev,
        gems: nextGems,
        elementalPacks: currentPacks,
      };
    });
  };

  // Claim rewards when opening an Elemental Pack from Inventory > Consumables
  const handleClaimElementalPack = (
    element: ElementType,
    rewardStarmon: Starmon,
    _isDuplicate: boolean,
    cardsGranted: number,
    openNext?: boolean
  ) => {
    setPlayer(prev => {
      const currentPacks = { ...(prev.elementalPacks || {}) };
      currentPacks[element] = Math.max(0, (currentPacks[element] || 0) - 1);
      const currentParty = prev.battleParty || [];
      const updatedParty = currentParty.includes(rewardStarmon.id)
        ? currentParty
        : currentParty.length < 3
        ? [...currentParty, rewardStarmon.id]
        : currentParty;

      return {
        ...prev,
        elementalPacks: currentPacks,
        activeCompanionId: prev.activeCompanionId || rewardStarmon.id,
        battleParty: updatedParty,
      };
    });

    setStarmons(prev =>
      prev.map(s => {
        if (s.id === rewardStarmon.id) {
          return {
            ...s,
            unlocked: true,
            cards: s.cards + cardsGranted,
          };
        }
        return s;
      })
    );

    if (!openNext || (player.elementalPacks?.[element] || 0) <= 1) {
      setOpeningElementalPack(null);
    }
  };

  const handleCraftItem = (slot: number, itemId: string) => {
    const item = EQUIPMENT_ITEMS_CATALOG[itemId];
    if (slot !== 0 || !item?.slotType || item.slotType === 'special') return;
    setPlayer(prev => {
      if ((prev.craftingJobs || []).some(job => job.slot === slot)) return prev;
      if (prev.gold < ITEM_CRAFT_COST.gold || prev.energy < ITEM_CRAFT_COST.energy || (prev.specialItems?.starShard || 0) < ITEM_CRAFT_COST.starShards) return prev;
      return {
        ...prev,
        gold: prev.gold - ITEM_CRAFT_COST.gold,
        energy: prev.energy - ITEM_CRAFT_COST.energy,
        specialItems: { ...(prev.specialItems || { starShard: 0, goldenAnvil: 0 }), starShard: (prev.specialItems?.starShard || 0) - ITEM_CRAFT_COST.starShards },
        craftingJobs: [...(prev.craftingJobs || []), { slot, itemId, completesAt: Date.now() + ITEM_CRAFT_COST.minutes * 60 * 1000 }],
      };
    });
  };

  const handleStartResearch = (element: ElementType, nodeId: ResearchNodeId) => {
    const node = RESEARCH_NODES.find(entry => entry.id === nodeId);
    if (!node) return;
    setPlayer(prev => {
      const slot = 0; // Research Queue 2 remains locked in the current design.
      const levels = prev.techResearchLevels || {};
      const currentLevel = getResearchLevel(levels, element, nodeId);
      const royalCost = node.cost.royalTokens || 0;
      if ((prev.researchJobs || []).some(job => job.slot === slot) || currentLevel >= node.maxLevel || !isResearchNodeUnlocked(levels, element, node)) return prev;
      if (prev.energy < node.cost.energy || prev.gold < node.cost.gold || (prev.royalTokens || 0) < royalCost) return prev;
      const job: ResearchJob = { slot, element, nodeId, completesAt: Date.now() + node.cost.hours * 60 * 60 * 1000 };
      return {
        ...prev,
        energy: prev.energy - node.cost.energy,
        gold: prev.gold - node.cost.gold,
        royalTokens: (prev.royalTokens || 0) - royalCost,
        researchJobs: [...(prev.researchJobs || []), job],
      };
    });
  };

  const handleFastForwardResearch = (slot: number) => {
    setPlayer(prev => {
      const job = (prev.researchJobs || []).find(entry => entry.slot === slot);
      if (!job) return prev;
      const minutes = Math.ceil(Math.max(0, job.completesAt - Date.now()) / 60000);
      if (prev.gems < minutes) return prev;
      return {
        ...prev,
        gems: prev.gems - minutes,
        researchJobs: (prev.researchJobs || []).map(entry => entry.slot === slot ? { ...entry, completesAt: Date.now() } : entry),
      };
    });
  };

  const handleCompleteResearch = (slot: number) => {
    setPlayer(prev => {
      const now = Date.now();
      const completed = (prev.researchJobs || []).filter(job => job.slot === slot && job.completesAt <= now);
      if (completed.length === 0) return prev;
      const levels = { ...(prev.techResearchLevels || {}) };
      completed.forEach(job => {
        const branch = { ...(levels[job.element] || {}) };
        const node = RESEARCH_NODES.find(entry => entry.id === job.nodeId);
        if (node) branch[job.nodeId] = Math.min(node.maxLevel, (branch[job.nodeId] || 0) + 1);
        levels[job.element] = branch;
      });
      return {
        ...prev,
        techResearchLevels: levels,
        researchJobs: (prev.researchJobs || []).filter(job => !completed.includes(job)),
      };
    });
  };

  const handleClaimCraftedItem = (slot: number) => {
    setPlayer(prev => {
      const job = (prev.craftingJobs || []).find(entry => entry.slot === slot);
      if (!job || job.completesAt > Date.now()) return prev;
      const inv = [...(prev.equipmentInventory || [])];
      const existing = inv.find(entry => entry.itemId === job.itemId && (entry.level || 1) === 1);
      if (existing) existing.count += 1;
      else inv.push({ itemId: job.itemId, count: 1, level: 1, enhancement: 0 });
      return { ...prev, equipmentInventory: inv, craftingJobs: prev.craftingJobs?.filter(entry => entry.slot !== slot) || [] };
    });
  };

  const handleFastForwardCraft = (slot: number) => {
    setPlayer(prev => {
      const job = (prev.craftingJobs || []).find(entry => entry.slot === slot);
      if (!job) return prev;
      const minutes = Math.ceil(Math.max(0, job.completesAt - Date.now()) / 60000);
      if (prev.gems < minutes) return prev;
      return {
        ...prev,
        gems: prev.gems - minutes,
        craftingJobs: (prev.craftingJobs || []).map(entry => entry.slot === slot ? { ...entry, completesAt: Date.now() } : entry),
      };
    });
  };

  const handleUpgradeItem = (itemId: string, currentLevel: number) => {
    const cost = getEquipmentUpgradeCost(currentLevel + 1);
    if (!cost || currentLevel >= 100) return;
    setPlayer(prev => {
      const inv = [...(prev.equipmentInventory || [])];
      const sourceIdx = inv.findIndex(entry => entry.itemId === itemId && (entry.level || 1) === currentLevel && entry.count > 0);
      if (sourceIdx < 0 || prev.gold < cost.gold || (prev.specialItems?.starShard || 0) < cost.shards) return prev;
      inv[sourceIdx] = { ...inv[sourceIdx], count: inv[sourceIdx].count - 1 };
      const target = inv.find(entry => entry.itemId === itemId && (entry.level || 1) === currentLevel + 1);
      if (target) target.count += 1;
      else inv.push({ itemId, count: 1, level: currentLevel + 1, enhancement: 0 });
      return {
        ...prev,
        gold: prev.gold - cost.gold,
        specialItems: { ...(prev.specialItems || { starShard: 0, goldenAnvil: 0 }), starShard: (prev.specialItems?.starShard || 0) - cost.shards },
        equipmentInventory: inv.filter(entry => entry.count > 0),
      };
    });
  };

  const handleEquipItem = (starmonId: string, slotIndex: number, itemId: string, requestedLevel = 1) => {
    const owner = starmons.find(mon => mon.id === starmonId);
    if (!owner || !getUnlockedItemSlots(player.techResearchLevels, owner.element)[slotIndex]) return;
    const requestedStack = (player.equipmentInventory || []).find(entry => entry.itemId === itemId && (entry.level || 1) === requestedLevel && entry.count > 0);
    if (!requestedStack) return;
    const itemLevel = requestedLevel;
    // 1. Deduct 1 from equipmentInventory
    setPlayer(prev => {
      const inv = prev.equipmentInventory ? [...prev.equipmentInventory] : [];
      const itemIdx = inv.findIndex(i => i.itemId === itemId && (i.level || 1) === itemLevel && i.count > 0);
      if (itemIdx >= 0) {
        inv[itemIdx] = { ...inv[itemIdx], count: inv[itemIdx].count - 1 };
      }
      return {
        ...prev,
        equipmentInventory: inv,
      };
    });

    // 2. Equip onto starmon
    setStarmons(prev =>
      prev.map(s => {
        if (s.id === starmonId) {
          const currentEq = s.equippedItems ? [...s.equippedItems] : [null, null, null, null, null, null];
          const currentLevels = s.equippedItemLevels ? [...s.equippedItemLevels] : Array(6).fill(1);
          const prevItem = currentEq[slotIndex];
          if (prevItem) {
            const prevLevel = currentLevels[slotIndex] || 1;
            setPlayer(p => {
              const inv = p.equipmentInventory ? [...p.equipmentInventory] : [];
              const pIdx = inv.findIndex(i => i.itemId === prevItem && (i.level || 1) === prevLevel);
              if (pIdx >= 0) {
                inv[pIdx] = { ...inv[pIdx], count: inv[pIdx].count + 1 };
              } else {
                inv.push({ itemId: prevItem, count: 1, level: prevLevel, enhancement: 0 });
              }
              return { ...p, equipmentInventory: inv };
            });
          }
          currentEq[slotIndex] = itemId;
          currentLevels[slotIndex] = itemLevel;

          let newName = s.name;
          let newTitle = s.title;
          let newAvatarSeed = s.avatarSeed;
          let isDaPhuc = s.isDaPhucVersion;
          let slots = s.unlockedSlots ? [...s.unlockedSlots] : [false, false, false, false, false, false];

          if (s.id === 'aquanymph') {
            const hasUniform = currentEq.includes('da_phuc_uniform');
            if (hasUniform) {
              newName = 'Aquanymph Đa Phúc';
              newTitle = 'Phiên Bản Độc Quyền Đa Phúc';
              newAvatarSeed = 'aquanymph_dp';
              isDaPhuc = true;
              slots[0] = true;
            } else {
              newName = 'Aquanymph';
              newTitle = 'Lotus Water Sprite';
              newAvatarSeed = 'aquanymph';
              isDaPhuc = false;
            }
          }

          return {
            ...s,
            name: newName,
            title: newTitle,
            avatarSeed: newAvatarSeed,
            isDaPhucVersion: isDaPhuc,
            unlockedSlots: slots,
            equippedItems: currentEq,
            equippedItemLevels: currentLevels,
          };
        }
        return s;
      })
    );
  };

  const handleUpgradeEquippedItem = (starmonId: string, slotIndex: number, currentLevel: number) => {
    const itemId = starmons.find(mon => mon.id === starmonId)?.equippedItems?.[slotIndex];
    const cost = itemId ? getEquipmentUpgradeCost(currentLevel + 1) : null;
    if (!itemId || !EQUIPMENT_ITEMS_CATALOG[itemId]?.slotType || EQUIPMENT_ITEMS_CATALOG[itemId]?.slotType === 'special' || !cost || currentLevel >= 100 || player.gold < cost.gold || (player.specialItems?.starShard || 0) < cost.shards) return;
    setPlayer(prev => {
      if (prev.gold < cost.gold || (prev.specialItems?.starShard || 0) < cost.shards) return prev;
      return {
        ...prev,
        gold: prev.gold - cost.gold,
        specialItems: { ...(prev.specialItems || { starShard: 0, goldenAnvil: 0 }), starShard: (prev.specialItems?.starShard || 0) - cost.shards },
      };
    });
    setStarmons(prev => prev.map(mon => {
      if (mon.id !== starmonId || mon.equippedItems?.[slotIndex] !== itemId || (mon.equippedItemLevels?.[slotIndex] || 1) !== currentLevel) return mon;
      const levels = mon.equippedItemLevels ? [...mon.equippedItemLevels] : Array(6).fill(1);
      levels[slotIndex] = currentLevel + 1;
      return { ...mon, equippedItemLevels: levels };
    }));
  };

  const handleUnequipItem = (starmonId: string, slotIndex: number) => {
    setStarmons(prev =>
      prev.map(s => {
        if (s.id === starmonId) {
          const currentEq = s.equippedItems ? [...s.equippedItems] : [null, null, null, null, null, null];
          const currentLevels = s.equippedItemLevels ? [...s.equippedItemLevels] : Array(6).fill(1);
          const unequippedItemId = currentEq[slotIndex];
          const unequippedLevel = currentLevels[slotIndex] || 1;
          currentEq[slotIndex] = null;
          currentLevels[slotIndex] = null;

          if (unequippedItemId) {
            setPlayer(p => {
              const inv = p.equipmentInventory ? [...p.equipmentInventory] : [];
              const idx = inv.findIndex(i => i.itemId === unequippedItemId && (i.level || 1) === unequippedLevel);
              if (idx >= 0) {
                inv[idx] = { ...inv[idx], count: inv[idx].count + 1 };
              } else {
                inv.push({ itemId: unequippedItemId, count: 1, level: unequippedLevel, enhancement: 0 });
              }
              return { ...p, equipmentInventory: inv };
            });
          }

          let newName = s.name;
          let newTitle = s.title;
          let newAvatarSeed = s.avatarSeed;
          let isDaPhuc = s.isDaPhucVersion;

          if (s.id === 'aquanymph') {
            const hasUniform = currentEq.includes('da_phuc_uniform');
            if (hasUniform) {
              newName = 'Aquanymph Đa Phúc';
              newTitle = 'Phiên Bản Độc Quyền Đa Phúc';
              newAvatarSeed = 'aquanymph_dp';
              isDaPhuc = true;
            } else {
              newName = 'Aquanymph';
              newTitle = 'Lotus Water Sprite';
              newAvatarSeed = 'aquanymph';
              isDaPhuc = false;
            }
          }

          return {
            ...s,
            name: newName,
            title: newTitle,
            avatarSeed: newAvatarSeed,
            isDaPhucVersion: isDaPhuc,
            equippedItems: currentEq,
            equippedItemLevels: currentLevels,
          };
        }
        return s;
      })
    );
  };

  const handleClaimDaPhucPack = () => {
    if (player.claimedAquanymphDaPhucPack) return;
    // 1. Add 1 Da Phuc Uniform to player inventory & mark as claimed
    setPlayer(prev => {
      if (prev.claimedAquanymphDaPhucPack) return prev;
      const inv = prev.equipmentInventory ? [...prev.equipmentInventory] : [];
      const uniformIdx = inv.findIndex(i => i.itemId === 'da_phuc_uniform');
      if (uniformIdx >= 0) {
        inv[uniformIdx] = { ...inv[uniformIdx], count: inv[uniformIdx].count + 1 };
      } else {
        inv.push({ itemId: 'da_phuc_uniform', count: 1 });
      }
      return {
        ...prev,
        claimedAquanymphDaPhucPack: true,
        equipmentInventory: inv,
        activeCompanionId: prev.activeCompanionId || 'aquanymph',
        battleParty: prev.battleParty && prev.battleParty.length > 0
          ? (prev.battleParty.includes('aquanymph') ? prev.battleParty : [...prev.battleParty.filter(id => id !== 'aquanymph_daphuc'), 'aquanymph'])
          : ['aquanymph'],
      };
    });

    // 2. Unlock Aquanymph (Aquanymph and Aquanymph Da Phuc are the same Starmon) with slot 1 unlocked!
    setStarmons(prev => {
      // Remove any legacy duplicate 'aquanymph_daphuc'
      const cleaned = prev.filter(s => s.id !== 'aquanymph_daphuc');
      return cleaned.map(s => {
        if (s.id === 'aquanymph') {
          const slots = s.unlockedSlots ? [...s.unlockedSlots] : [true, false, false, false, false, false];
          slots[0] = true;
          return {
            ...s,
            unlocked: true,
            cards: Math.max(s.cards, 25),
            unlockedSlots: slots,
          };
        }
        return s;
      });
    });
  };

  // Awaken / Unlock an Unobtained Starmon directly with cards
  const handleAwakenStarmon = (starmonId: string, cardsCost: number) => {
    setStarmons(prev =>
      prev.map(s => {
        if (s.id === starmonId) {
          return {
            ...s,
            unlocked: true,
            cards: Math.max(0, s.cards - cardsCost),
          };
        }
        return s;
      })
    );

    setPlayer(prev => {
      const currentParty = prev.battleParty || [];
      const updatedParty = currentParty.includes(starmonId)
        ? currentParty
        : (currentParty.length < 3 ? [...currentParty, starmonId] : currentParty);
      return {
        ...prev,
        activeCompanionId: prev.activeCompanionId || starmonId,
        battleParty: updatedParty,
      };
    });
  };

  // Level Up Starmon
  const handleLevelUp = (starmonId: string, cardsCost: number, goldCost: number) => {
    setPlayer(prev => {
      const nextExp = prev.exp + 50;
      let newLevel = prev.level;
      let targetNextExp = prev.nextExp;

      if (nextExp >= prev.nextExp) {
        newLevel += 1;
        targetNextExp = Math.floor(prev.nextExp * 1.3);
      }

      return {
        ...prev,
        gold: Math.max(0, prev.gold - goldCost),
        level: newLevel,
        exp: nextExp % prev.nextExp,
        nextExp: targetNextExp,
      };
    });

    setStarmons(prev =>
      prev.map(s => {
        if (s.id === starmonId) {
          const starmonClass = getStarmonClass(s.id);
          const nextLevel = Math.min(100, s.level + 1);
          const levelStats = starmonClass ? getStatsForLevel(starmonClass, nextLevel) : undefined;
          return {
            ...s,
            level: nextLevel,
            cards: Math.max(0, s.cards - cardsCost),
            ...(levelStats ? {
              starmonClass,
              maxHp: levelStats.hp,
              currentHp: levelStats.hp,
              baseAtk: levelStats.atk,
              def: levelStats.def,
              cp: calculateCP(levelStats.hp, levelStats.atk, levelStats.def),
            } : {}),
          };
        }
        return s;
      })
    );

    // Track Weekly Quest: Growth & Ascension
    setQuests(prev =>
      prev.map(q =>
        q.id === 'weekly_level_up'
          ? { ...q, currentProgress: Math.min(q.maxProgress, q.currentProgress + 1) }
          : q
      )
    );
  };

  // Set Active Companion
  const handleSetActiveCompanion = (starmonId: string) => {
    setPlayer(prev => ({
      ...prev,
      activeCompanionId: starmonId,
    }));
  };

  // Quest Event Tracker during battle
  const handleQuestEvent = (
    category: 'match_orbs' | 'deal_damage' | 'speaking_band' | 'combo_hyper' | 'cast_skill',
    data?: any
  ) => {
    setQuests(prev =>
      prev.map(q => {
        if (category === 'match_orbs') {
          const elem = data?.element;
          const count = data?.count || 0;
          if (q.id === 'daily_match3') {
            return { ...q, currentProgress: Math.min(q.maxProgress, q.currentProgress + count) };
          }
          if (elem === 'Water' && (q.id === 'monthly_match_water_100' || q.id === 'monthly_match_water_250')) {
            return { ...q, currentProgress: Math.min(q.maxProgress, q.currentProgress + count) };
          }
          if (elem === 'Fire' && (q.id === 'monthly_match_fire_100' || q.id === 'monthly_match_fire_250')) {
            return { ...q, currentProgress: Math.min(q.maxProgress, q.currentProgress + count) };
          }
          if (elem === 'Earth' && (q.id === 'monthly_match_earth_100' || q.id === 'monthly_match_earth_250')) {
            return { ...q, currentProgress: Math.min(q.maxProgress, q.currentProgress + count) };
          }
          if (elem === 'Electric' && (q.id === 'monthly_match_electric_100' || q.id === 'monthly_match_electric_250')) {
            return { ...q, currentProgress: Math.min(q.maxProgress, q.currentProgress + count) };
          }
        }

        if (category === 'deal_damage') {
          const elem = data?.element;
          const dmg = data?.damage || 0;
          if (q.id.startsWith('legend_calamity_')) {
            return { ...q, currentProgress: Math.min(q.maxProgress, q.currentProgress + dmg) };
          }
          if (elem === 'Water' && (q.id === 'monthly_dmg_water_10k' || q.id === 'monthly_dmg_water_30k')) {
            return { ...q, currentProgress: Math.min(q.maxProgress, q.currentProgress + dmg) };
          }
          if (elem === 'Fire' && (q.id === 'monthly_dmg_fire_10k' || q.id === 'monthly_dmg_fire_30k')) {
            return { ...q, currentProgress: Math.min(q.maxProgress, q.currentProgress + dmg) };
          }
          if (elem === 'Earth' && (q.id === 'monthly_dmg_earth_10k' || q.id === 'monthly_dmg_earth_30k')) {
            return { ...q, currentProgress: Math.min(q.maxProgress, q.currentProgress + dmg) };
          }
          if (elem === 'Electric' && (q.id === 'monthly_dmg_electric_10k' || q.id === 'monthly_dmg_electric_30k')) {
            return { ...q, currentProgress: Math.min(q.maxProgress, q.currentProgress + dmg) };
          }
        }

        if (category === 'speaking_band') {
          const band = data?.band || 0;
          if (band >= 5 && q.id === 'daily_speaking') {
            return { ...q, currentProgress: Math.min(q.maxProgress, q.currentProgress + 1) };
          }
          if (band >= 6.5 && q.id === 'weekly_band65_10') {
            return { ...q, currentProgress: Math.min(q.maxProgress, q.currentProgress + 1) };
          }
          if (band >= 7 && q.id === 'weekly_band7') {
            return { ...q, currentProgress: Math.min(q.maxProgress, q.currentProgress + 1) };
          }
          if (q.id === 'monthly_ielts_master') {
            return { ...q, currentProgress: Math.min(q.maxProgress, q.currentProgress + 1) };
          }
          if (band >= 8 && q.id.startsWith('legend_ielts_epic_')) {
            return { ...q, currentProgress: Math.min(q.maxProgress, q.currentProgress + 1) };
          }
          if (band >= 9 && q.id === 'legend_band9') {
            return { ...q, currentProgress: Math.min(q.maxProgress, q.currentProgress + 1) };
          }
        }

        if (category === 'combo_hyper' && q.id === 'weekly_combo_5') {
          return { ...q, currentProgress: Math.min(q.maxProgress, q.currentProgress + 1) };
        }

        if (category === 'cast_skill' && q.id === 'daily_skill') {
          return { ...q, currentProgress: Math.min(q.maxProgress, q.currentProgress + 1) };
        }

        return q;
      })
    );
  };

  // Exit Battle & Process Victory Rewards
  // Separate card reward: adds cards specifically to cardStarmonId!
  const handleExitBattle = (
    result: 'win' | 'loss',
    rewards?: { gold: number; cards: number; cardStarmonId?: string; exp: number }
  ) => {
    setActiveTutorialStage(null);
    setActiveScreen('hub');

    // Update match count & victory quests
    setQuests(prev =>
      prev.map(q => {
        if (q.id === 'daily_play_3') return { ...q, currentProgress: Math.min(q.maxProgress, q.currentProgress + 1) };
        if (q.id === 'weekly_play_10') return { ...q, currentProgress: Math.min(q.maxProgress, q.currentProgress + 1) };
        if (result === 'win') {
          if (q.id === 'daily_win_1') return { ...q, currentProgress: Math.min(q.maxProgress, q.currentProgress + 1) };
          if (q.id === 'weekly_win_5') return { ...q, currentProgress: Math.min(q.maxProgress, q.currentProgress + 1) };
          if (q.id === 'monthly_boss_defeat') return { ...q, currentProgress: Math.min(q.maxProgress, q.currentProgress + 1) };
        }
        return q;
      })
    );

    if (result === 'win' && rewards) {
      setPlayer(prev => {
        const isTut1AlreadyClaimed = activeTutorialStage === 1 && prev.hasClaimedTutorial1Reward;
        const goldBonus = isTut1AlreadyClaimed ? 0 : rewards.gold;
        const nextExp = prev.exp + rewards.exp;
        let newLevel = prev.level;
        let targetNextExp = prev.nextExp;

        if (nextExp >= prev.nextExp) {
          newLevel += 1;
          targetNextExp = Math.floor(prev.nextExp * 1.3);
        }

        return {
          ...prev,
          gold: prev.gold + goldBonus,
          hasClaimedTutorial1Reward: activeTutorialStage === 1 ? true : prev.hasClaimedTutorial1Reward,
          completedTutorialStages: activeTutorialStage === 1
            ? Array.from(new Set([...(prev.completedTutorialStages || []), 1]))
            : prev.completedTutorialStages,
          level: newLevel,
          exp: nextExp % prev.nextExp,
          nextExp: targetNextExp,
        };
      });

      // Grant cards specifically to the randomly rolled Starmon (obtained or unobtained)!
      const targetMonId = rewards.cardStarmonId || player.activeCompanionId;
      if (targetMonId) {
        setStarmons(prev =>
          prev.map(s => (s.id === targetMonId ? { ...s, cards: s.cards + rewards.cards } : s))
        );
      }
    }
  };

  // Restore Save Data (From Uploaded JSON file or Account Login)
  const handleRestoreSave = (
    loadedPlayer: PlayerProfile,
    loadedStarmons: Starmon[],
    accountUsername?: string,
    loadedQuests?: QuestItem[]
  ) => {
    const uname = accountUsername || loadedPlayer.username || loadedPlayer.name || 'Player';
    setPlayer({
      ...loadedPlayer,
      quizQuestionMode: loadedPlayer.quizQuestionMode === 'part1_preference' ? 'part1_preference' : 'random',
      speakingLog: Array.isArray(loadedPlayer.speakingLog) ? loadedPlayer.speakingLog : [],
      name: uname,
      username: uname,
      royalTokens: loadedPlayer.royalTokens || 0,
      omniStarmonCards: loadedPlayer.omniStarmonCards || 0,
      commonItemPacks: loadedPlayer.commonItemPacks || 0,
      techResearchLevels: loadedPlayer.techResearchLevels || {},
      researchJobs: loadedPlayer.researchJobs || [],
      energy: loadedPlayer.energy !== undefined ? loadedPlayer.energy : 100,
      maxEnergy: 100,
      lastEnergyRegenTime: loadedPlayer.lastEnergyRegenTime || Date.now(),
      energyBatteries: {
        battery50: loadedPlayer.energyBatteries?.battery50 !== undefined ? loadedPlayer.energyBatteries.battery50 : 5,
        battery100: loadedPlayer.energyBatteries?.battery100 !== undefined ? loadedPlayer.energyBatteries.battery100 : 3,
        battery200: loadedPlayer.energyBatteries?.battery200 !== undefined ? loadedPlayer.energyBatteries.battery200 : 1,
      },
      specialItems: {
        starShard: loadedPlayer.specialItems?.starShard !== undefined ? loadedPlayer.specialItems.starShard : 15,
        goldenAnvil: loadedPlayer.specialItems?.goldenAnvil !== undefined ? loadedPlayer.specialItems.goldenAnvil : 5,
      },
    });
    const savedMap = new Map((loadedStarmons || []).map(s => [s.id, s]));
    const merged = STARMON_ROSTER.map(rosterMon => {
      const userMon = savedMap.get(rosterMon.id);
      if (userMon) {
        const level = userMon.level || 1;
        const starmonClass = getStarmonClass(rosterMon.id);
        const levelStats = starmonClass ? getStatsForLevel(starmonClass, level) : undefined;
        return {
          ...rosterMon,
          unlocked: !!userMon.unlocked,
          cards: userMon.cards || 0,
          level,
          starmonClass: starmonClass || undefined,
          maxHp: levelStats?.hp ?? rosterMon.maxHp,
          currentHp: levelStats?.hp ?? rosterMon.maxHp,
          baseAtk: levelStats?.atk ?? rosterMon.baseAtk,
          def: levelStats?.def ?? rosterMon.def,
          cp: levelStats?.cp ?? calculateCP(rosterMon.maxHp, rosterMon.baseAtk, rosterMon.def),
        };
      }
      return {
        ...rosterMon,
        unlocked: false,
        cards: 0,
        level: 1,
      };
    });
    setStarmons(merged);

    // Scoped Quests Restore
    const cleanFreshQuests = INITIAL_QUESTS.map(q => ({ ...q, currentProgress: 0, claimed: false }));
    const restoredQuests = loadedQuests && loadedQuests.length > 0 ? loadedQuests : cleanFreshQuests;
    setQuests(restoredQuests);
    try {
      localStorage.setItem(`${STORAGE_KEY}_quests_${uname.toLowerCase()}`, JSON.stringify(restoredQuests));
    } catch {}
  };

  // Switch User Profile (Loads user's full data & quests or initializes new account)
  const handleSwitchUser = async (username: string) => {
    const accounts = getAllAccounts();
    let acc = accounts[username.toLowerCase()];
    if (!acc) {
      try {
        const sRes = await fetch(`/api/accounts/${encodeURIComponent(username)}`);
        if (sRes.ok) {
          acc = await sRes.json();
        }
      } catch {}
    }
    if (acc) {
      handleRestoreSave(acc.player, acc.starmons, acc.username, acc.quests);
    } else {
      const cleanFreshQuests = INITIAL_QUESTS.map(q => ({ ...q, currentProgress: 0, claimed: false }));
      setQuests(cleanFreshQuests);
      try {
        localStorage.setItem(`${STORAGE_KEY}_quests_${username.toLowerCase()}`, JSON.stringify(cleanFreshQuests));
      } catch {}
      setPlayer({
        name: username,
        username: username === 'Guest Adventurer' ? undefined : username,
        level: 1,
        exp: 0,
        nextExp: 100,
        gold: 0,
        gems: 0,
        royalTokens: 0,
        omniStarmonCards: 0,
        commonItemPacks: 0,
        energy: 100,
        maxEnergy: 100,
        lastEnergyRegenTime: Date.now(),
        energyBatteries: {
          battery50: 5,
          battery100: 3,
          battery200: 1,
        },
        specialItems: {
          starShard: 15,
          goldenAnvil: 5,
        },
        starterPacksCount: 2,
        isNewPlayer: true,
        hasClaimedBeginnerPack: false,
        activeCompanionId: '',
        battleParty: [],
        techResearchLevels: {},
        researchJobs: [],
        mailUnreadCount: 1,
        soundEnabled: true,
        musicEnabled: true,
        showSpeakingHints: false,
        graphicsQuality: 'High',
      });
      setStarmons(
        STARMON_ROSTER.map(s => ({
          ...s,
          unlocked: false,
          cards: 0,
          level: 1,
        }))
      );
    }
  };

  // Reset Game Data & Reload Page: Wipes all progress and returns account back to starting point (Level 1, 0 Gold, 2 Starter Packs, 0 Starmon)
  const handleResetData = async () => {
    try {
      sound.playClick();
      const u = player.username || getCurrentUsername() || 'Player';
      const gid = player.googleId || localStorage.getItem('starmon_pvp_uid') || '';

      // 0. Set session reset flag so subsequent reload doesn't restore old progress
      try {
        sessionStorage.setItem('starmon_just_reset', 'true');
      } catch {}

      // 1. Reset in the configured Firebase Cloud Firestore project.
      try {
        if (gid) await resetAccountInFirestore(gid, u);
        if (u) await resetAccountInFirestore(u, u);
      } catch (e) {
        console.warn('Firestore reset notice:', e);
      }

      // 2. Reset on Express server store
      try {
        await fetch('/api/accounts/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u, googleId: gid }),
        });
      } catch (e) {
        console.warn('Server account reset notice:', e);
      }

      // 3. Clear all localStorage keys
      try {
        localStorage.clear();
      } catch {}

      // 4. Force reload page to restart completely from scratch!
      window.location.reload();
    } catch {
      try {
        localStorage.clear();
      } catch {}
      window.location.reload();
    }
  };

  // Update Battle Party lineup
  const handleUpdateBattleParty = (partyIds: string[]) => {
    if (partyIds.length < 1) return;
    setPlayer(prev => ({
      ...prev,
      battleParty: partyIds,
    }));
  };

  // Redeem Code Handler
  const handleRedeemCode = (rawCode: string): { success: boolean; message: string } => {
    const code = rawCode.trim().toLowerCase();

    // Resource test codes are intentionally not listed in the interface.
    const resourceTestCodes: Record<string, string> = {
      goldtest: 'Gold',
      gemstest: 'Gems',
      energytest: 'Energy',
      royaltokenstest: 'Royal Tokens',
      starshardtest: 'Star Shards',
      goldenanviltest: 'Golden Anvils',
    };
    const resourceName = resourceTestCodes[code];
    if (resourceName) {
      setPlayer(prev => {
        if (code === 'goldtest') return { ...prev, gold: prev.gold + 5000 };
        if (code === 'gemstest') return { ...prev, gems: prev.gems + 5000 };
        if (code === 'energytest') return { ...prev, energy: prev.energy + 5000 };
        if (code === 'royaltokenstest') return { ...prev, royalTokens: (prev.royalTokens || 0) + 5000 };
        const specialItems = prev.specialItems || { starShard: 0, goldenAnvil: 0 };
        if (code === 'starshardtest') return { ...prev, specialItems: { ...specialItems, starShard: specialItems.starShard + 5000 } };
        return { ...prev, specialItems: { ...specialItems, goldenAnvil: specialItems.goldenAnvil + 5000 } };
      });
      return { success: true, message: `+5,000 ${resourceName}` };
    }

    // Secret Code 1: Gems5000 (+5000 Gems)
    if (code === 'gems5000') {
      setPlayer(prev => ({
        ...prev,
        gems: prev.gems + 5000,
      }));
      return {
        success: true,
        message: 'Kích hoạt thành công mã bí mật! Bạn đã nhận được +5,000 Gems!',
      };
    }

    // Secret Code 2: OpenItemSlot1 (Unlock all Starmon Slot 1)
    if (code === 'openitemslot1') {
      setStarmons(prev =>
        prev.map(s => {
          const slots = s.unlockedSlots ? [...s.unlockedSlots] : [false, false, false, false, false, false];
          slots[0] = true;
          return {
            ...s,
            unlockedSlots: slots,
          };
        })
      );
      return {
        success: true,
        message: 'Kích hoạt thành công mã bí mật! Đã mở khóa tất cả ô trang bị số 1 cho toàn bộ Starmon!',
      };
    }

    // Secret Code 3: ItemOldPickaxe (+1 Old Pickaxe into inventory)
    if (code === 'itemoldpickaxe') {
      setPlayer(prev => {
        const inv = prev.equipmentInventory ? [...prev.equipmentInventory] : [];
        const existingIdx = inv.findIndex(i => i.itemId === 'old_pickaxe');
        if (existingIdx >= 0) {
          inv[existingIdx] = { ...inv[existingIdx], count: inv[existingIdx].count + 1 };
        } else {
          inv.push({ itemId: 'old_pickaxe', count: 1 });
        }
        return {
          ...prev,
          equipmentInventory: inv,
        };
      });
      return {
        success: true,
        message: 'Kích hoạt thành công mã bí mật! Đã nhận 1 trang bị Old Pickaxe vào kho đồ!',
      };
    }

    if (code === 'unittest') {
      const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
      const expiry = Date.now() + fiveDaysMs;
      setPlayer(prev => ({
        ...prev,
        unitTestExpiry: expiry,
      }));
      return {
        success: true,
        message: 'Kích hoạt thành công mã UnitTest! Bạn có thể thức tỉnh và nâng cấp Starmon với giá 0 đồng / 0 Cards trong 5 ngày tới.',
      };
    }

    return {
      success: false,
      message: 'Mã không hợp lệ. Vui lòng kiểm tra lại.',
    };
  };

  // Start Battle with PvP room info (requires at least 1 Starmon in Battle Party)
  const handleStartBattle = (roomInfo?: {
    code: string;
    hostName: string;
    hostId?: string;
    arena: string;
    myPlayerId?: string;
    myPlayerName?: string;
    isHost?: boolean;
    opponentId?: string;
    opponentName?: string;
    opponentStarmons?: Starmon[];
  }) => {
    const unlockedStarmons = starmons.filter(s => s.unlocked);
    const party = (player.battleParty && player.battleParty.length > 0)
      ? player.battleParty.filter(id => unlockedStarmons.some(s => s.id === id))
      : unlockedStarmons.map(s => s.id);

    if (party.length === 0) {
      sound.playWrong();
      alert('Yêu cầu trong Party luôn có ít nhất 1 Starmon để bắt đầu!');
      return;
    }

    setActivePvpRoom(roomInfo || null);
    setActiveScreen('battle');
  };

  const battlePartyStarmons = useMemo(() => {
    if (activeTutorialStage === 1) {
      const voltlynxMon = STARMON_ROSTER.find(s => s.id === 'voltlynx') || STARMON_ROSTER[0];
      return [{ ...voltlynxMon, unlocked: true, level: 1 }];
    }
    const unlocked = starmons.filter(s => s.unlocked);
    if (activeTutorialStage && unlocked.length === 0) {
      return [
        { ...STARMON_ROSTER[0], unlocked: true },
        { ...STARMON_ROSTER[1], unlocked: true },
        { ...STARMON_ROSTER[4], unlocked: true },
      ];
    }
    const partyIds = (player.battleParty && player.battleParty.length > 0)
      ? player.battleParty.filter(id => unlocked.some(s => s.id === id))
      : unlocked.map(s => s.id).slice(0, 3);
    const applyResearchStats = (mon: Starmon): Starmon => {
      const bonus = getResearchStatBonuses(player.techResearchLevels, mon.element);
      const hpScale = 1 + bonus.hp / 100;
      return {
        ...mon,
        cp: mon.cp || calculateCP(mon.maxHp, mon.baseAtk, mon.def),
        maxHp: Math.round(mon.maxHp * hpScale),
        currentHp: Math.min(Math.round(mon.maxHp * hpScale), Math.round(mon.currentHp * hpScale)),
        baseAtk: Math.round(mon.baseAtk * (1 + bonus.atk / 100)),
        def: Math.round(mon.def * (1 + bonus.def / 100)),
        researchCritChance: bonus.crit / 100,
        researchPhysicalDamageReduction: bonus.reduction / 100,
      };
    };
    const applyEquipStats = (mon: Starmon): Starmon => {
      const itemStats = (mon.equippedItems || []).reduce((total, itemId, slot) => {
        if (!itemId) return total;
        const stats = getItemLevelStats(itemId, mon.equippedItemLevels?.[slot] || 1);
        return { hp: total.hp + stats.hp, atk: total.atk + stats.atk, def: total.def + stats.def };
      }, { hp: 0, atk: 0, def: 0 });
      if (itemStats.hp + itemStats.atk + itemStats.def === 0) return mon;
      const newMaxHp = mon.maxHp + itemStats.hp;
      return {
        ...mon,
        maxHp: newMaxHp,
        currentHp: newMaxHp,
        baseAtk: mon.baseAtk + itemStats.atk,
        def: mon.def + itemStats.def,
      };
    };

    const party = partyIds
      .map(id => starmons.find(s => s.id === id && s.unlocked))
      .filter((s): s is Starmon => !!s)
      .map(applyResearchStats)
      .map(applyEquipStats);
    return party.length > 0 ? party : (unlocked.length > 0 ? unlocked.slice(0, 3).map(applyResearchStats).map(applyEquipStats) : [
      { ...STARMON_ROSTER[0], unlocked: true },
      { ...STARMON_ROSTER[1], unlocked: true },
      { ...STARMON_ROSTER[4], unlocked: true },
    ]);
  }, [activeTutorialStage, starmons, player.battleParty, player.techResearchLevels]);

  return (
    <div className="w-screen h-screen max-h-screen overflow-hidden bg-slate-950 font-sans flex flex-col justify-between relative select-none">
      {/* Microphone Status Banner if not granted yet */}
      {hasMicPermission === false && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-indigo-950/90 border border-amber-400 text-slate-100 px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-2xl backdrop-blur-md">
          <span>🎙️ Microphone permission is recommended for IELTS Speaking.</span>
          <button
            onClick={() => setShowMicModal(true)}
            className="px-2.5 py-0.5 bg-amber-400 text-slate-950 rounded-full font-black hover:bg-amber-300 cursor-pointer"
          >
            Enable Mic
          </button>
        </div>
      )}

      {/* SCREEN 1: MAIN HUB LOBBY */}
      {activeScreen === 'hub' && (
        <MainHub
          player={player}
          activeStarmon={activeStarmon}
          playerStarmons={battlePartyStarmons}
          allOwnedStarmons={starmons.filter(mon => mon.unlocked)}
          unlockedStarmonCount={unlockedCount}
          isFullscreen={isFullscreen}
          unclaimedQuestsCount={quests.filter(q => !q.claimed && q.currentProgress >= q.maxProgress).length}
          unclaimedEventsCount={(() => { const reward = getDailyRewardStatus(player.dailyRewardProgress, new Date()); return reward.canClaimToday ? 1 : 0; })()}
          unreadChatCount={0}
          onToggleFullscreen={toggleFullscreen}
          onOpenSettings={() => setShowSettingsModal(true)}
          onOpenTutorial={() => setShowTutorialModal(true)}
          onOpenEnergyBattery={() => setShowEnergyBatteryModal(true)}
          onOpenStarmonTeam={() => setActiveScreen('inventory')}
          onOpenInventory={() => setShowInventoryModal(true)}
          onOpenShop={() => setShowShopModal(true)}
          onOpenMail={() => {
            setPlayer(p => ({ ...p, mailUnreadCount: 0 }));
            setShowMailModal(true);
          }}
          onOpenAuth={() => {
            setAuthInitialTab('profile');
            setShowAuthModal(true);
          }}
          onOpenStarterPack={() => setShowPackModal(true)}
          onOpenQuests={() => setShowQuestModal(true)}
          onOpenEvents={() => setShowEventsModal(true)}
          onOpenChat={() => setShowChatModal(true)}
          onStartBattle={handleStartBattle}
          onCraftItem={handleCraftItem}
          onClaimCraftedItem={handleClaimCraftedItem}
          onFastForwardCraft={handleFastForwardCraft}
          onUpgradeItem={handleUpgradeItem}
          onUpgradeEquippedItem={handleUpgradeEquippedItem}
          onStartResearch={handleStartResearch}
          onFastForwardResearch={handleFastForwardResearch}
          onCompleteResearch={handleCompleteResearch}
          onUpdateGoogleAccount={(googleId, googleEmail) => {
            setPlayer(prev => ({
              ...prev,
              googleId,
              googleEmail,
              name: googleEmail ? googleEmail.split('@')[0] : prev.name,
              username: googleEmail ? googleEmail.split('@')[0] : prev.username,
            }));
            try {
              localStorage.setItem('starmon_google_id', googleId);
              localStorage.setItem('starmon_pvp_uid', googleId);
            } catch {}
          }}
        />
      )}

      {/* ONBOARDING FLOW SPOTLIGHT FOR NEW PLAYERS */}
      {activeScreen === 'hub' &&
        !showMicModal &&
        !showAuthModal &&
        !showPackModal &&
        !showSettingsModal &&
        !showShopModal &&
        !showMailModal &&
        !showQuestModal &&
        !showEventsModal &&
        !showInventoryModal &&
        !showChatModal &&
        !showTutorialModal &&
        !player.hasCompletedOnboardingTutorial && (
          <OnboardingSpotlight
            isActive={true}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            onStartTutorial={handleOnboardingStartTutorial}
          />
        )}

      {/* SCREEN 2: STARMON MANAGEMENT & LEVEL UP */}
      {activeScreen === 'inventory' && (
        <StarmonManagement
          starmons={starmons}
          playerGold={player.gold}
          activeCompanionId={player.activeCompanionId}
          battleParty={player.battleParty}
          unitTestExpiry={player.unitTestExpiry}
          equipmentInventory={player.equipmentInventory}
          specialItems={player.specialItems}
          omniStarmonCards={player.omniStarmonCards || 0}
          techResearchLevels={player.techResearchLevels}
          onClose={() => setActiveScreen('hub')}
          onLevelUp={handleLevelUp}
          onConvertOmniCards={handleConvertOmniCards}
          onSetActiveCompanion={handleSetActiveCompanion}
          onAwakenStarmon={handleAwakenStarmon}
          onUpdateBattleParty={handleUpdateBattleParty}
          onEquipItem={handleEquipItem}
          onUnequipItem={handleUnequipItem}
          onUpgradeEquippedItem={handleUpgradeEquippedItem}
        />
      )}

      {/* SCREEN 3: BATTLE ARENA (PHASE 1 QUIZ/IELTS & PHASE 2 MATCH-3) */}
      {activeScreen === 'battle' && (
        <BattleView
          playerStarmons={battlePartyStarmons} // RESPECTS BATTLE PARTY LINEUP & ORDER
          allRosterStarmons={STARMON_ROSTER} // Full roster for Victory Chest random drops (obtained and unobtained!)
          isFullscreen={isFullscreen}
          showSpeakingHints={player.showSpeakingHints ?? false}
          questionMode={player.quizQuestionMode || 'random'}
          onChangeQuestionMode={mode => setPlayer(p => ({ ...p, quizQuestionMode: mode }))}
          onSaveSpeakingLog={(entry: SpeakingLogEntry) => setPlayer(p => ({
            ...p,
            speakingLog: [entry, ...(p.speakingLog || [])].slice(0, 30),
          }))}
          onToggleFullscreen={toggleFullscreen}
          onExitBattle={handleExitBattle}
          onQuestProgress={handleQuestEvent}
          pvpRoomInfo={activePvpRoom}
          tutorialStage={activeTutorialStage}
          hasClaimedTutorialReward={Boolean(player.hasClaimedTutorial1Reward)}
          onSkipTutorial={() => {
            setActiveTutorialStage(null);
            setActiveScreen('hub');
          }}
          onNextTutorialStage={(nextStage) => {
            setActiveTutorialStage(nextStage);
          }}
          onTutorial1Reward={handleTutorial1Reward}
          onRequestMicrophone={() => {
            if (!hasMicPermission) {
              requestMicrophoneAccess();
            }
          }}
        />
      )}

      {/* MODAL: MICROPHONE PERMISSION REQUEST ON GAME ACCESS */}
      <MicrophonePermissionModal
        isOpen={showMicModal}
        onClose={() => setShowMicModal(false)}
        onPermissionGranted={() => {
          setHasMicPermission(true);
        }}
      />

      {/* MODAL: BEGINNER PACK UNBOXING */}
      {showPackModal && (
        <BeginnerPackModal
          starterPacksAvailable={player.starterPacksCount}
          unlockedStarmonIds={starmons.filter(s => s.unlocked).map(s => s.id)}
          onClose={() => setShowPackModal(false)}
          onClaim={handleClaimStarterPack}
        />
      )}

      {/* MODAL: MAILBOX */}
      {showMailModal && (
        <MailModal
          hasClaimedBeginnerPack={player.hasClaimedBeginnerPack}
          onOpenBeginnerPack={() => {
            setShowMailModal(false);
            setShowPackModal(true);
          }}
          onClose={() => setShowMailModal(false)}
        />
      )}

      {/* MODAL: SHOP */}
      {showShopModal && (
        <ShopModal
          playerGems={player.gems}
          starmons={starmons}
          hasClaimedDaPhucPack={player.claimedAquanymphDaPhucPack}
          onClose={() => setShowShopModal(false)}
          onPurchaseElementalPack={handlePurchaseElementalPack}
          onOpenInventory={() => {
            setShowShopModal(false);
            setShowInventoryModal(true);
          }}
          onClaimDaPhucPack={handleClaimDaPhucPack}
        />
      )}

      {/* MODAL: SETTINGS */}
      {showSettingsModal && (
        <SettingsModal
          soundEnabled={player.soundEnabled}
          musicEnabled={player.musicEnabled}
          volume={sound.getVolume()}
          showSpeakingHints={player.showSpeakingHints ?? false}
          questionMode={player.quizQuestionMode || 'random'}
          speakingLog={player.speakingLog || []}
          playerName={player.username || player.name}
          unitTestExpiry={player.unitTestExpiry}
          onToggleSound={() => {
            const next = !player.soundEnabled;
            sound.setSoundEnabled(next);
            setPlayer(p => ({ ...p, soundEnabled: next }));
          }}
          onToggleMusic={() => {
            const next = !player.musicEnabled;
            sound.setMusicEnabled(next);
            setPlayer(p => ({ ...p, musicEnabled: next }));
          }}
          onChangeVolume={v => {
            sound.setVolume(v);
          }}
          onToggleSpeakingHints={() => {
            setPlayer(p => ({ ...p, showSpeakingHints: !p.showSpeakingHints }));
          }}
          onChangeQuestionMode={mode => {
            setPlayer(p => ({ ...p, quizQuestionMode: mode }));
          }}
          onOpenAuthTab={(tab) => {
            setShowSettingsModal(false);
            setAuthInitialTab(tab);
            setShowAuthModal(true);
          }}
          onOpenTutorial={() => {
            setShowSettingsModal(false);
            setShowTutorialModal(true);
          }}
          onRedeemCode={handleRedeemCode}
          onResetData={handleResetData}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* MODAL: SIGN UP, LOG IN & CLOUD PROGRESS DOWNLOAD/UPLOAD */}
      {showAuthModal && (
        <AuthAndSaveModal
          player={player}
          starmons={starmons}
          quests={quests}
          initialTab={authInitialTab}
          onClose={() => setShowAuthModal(false)}
          onRestoreSave={handleRestoreSave}
          onSwitchUser={handleSwitchUser}
          onResetProgress={handleResetData}
        />
      )}

      {/* MODAL: COMBAT ACADEMY TUTORIAL */}
      {showTutorialModal && (
        <TutorialModal
          onClose={() => setShowTutorialModal(false)}
          onStartTutorialMatch={handleStartTutorialMatch}
          hasClaimedTutorial1Reward={Boolean(player.hasClaimedTutorial1Reward)}
        />
      )}

      {/* MODAL: QUEST SYSTEM (Daily, Weekly, Monthly, Legend) */}
      {showQuestModal && (
        <QuestModal
          quests={quests}
          onClose={() => setShowQuestModal(false)}
          onClaimReward={handleClaimQuest}
        />
      )}

      {showEventsModal && (
        <EventsModal
          player={player}
          ownedStarmons={starmons.filter(mon => mon.unlocked)}
          onClose={() => setShowEventsModal(false)}
          onClaimDailyReward={handleClaimDailyReward}
        />
      )}

      {/* MODAL: TRAINER INVENTORY & VAULT */}
      {showInventoryModal && (
        <InventoryModal
          player={player}
          starmons={starmons}
          onClose={() => setShowInventoryModal(false)}
          onOpenStarterPack={() => {
            setShowInventoryModal(false);
            setShowPackModal(true);
          }}
          onOpenElementalPack={(element: ElementType) => {
            setShowInventoryModal(false);
            setOpeningElementalPack(element);
          }}
          onSelectStarmonTab={() => {
            setShowInventoryModal(false);
            setActiveScreen('inventory');
          }}
          onUseBatteries={handleUseBatteries}
          onOpenCommonItemPack={handleOpenCommonItemPack}
        />
      )}

      {/* MODAL: ENERGY BATTERY VAULT & RECHARGE SLIDER */}
      {showEnergyBatteryModal && (
        <EnergyBatteryModal
          player={player}
          onClose={() => setShowEnergyBatteryModal(false)}
          onUseBatteries={handleUseBatteries}
        />
      )}

      {/* MODAL: ELEMENTAL PACK UNBOXING FROM INVENTORY */}
      {openingElementalPack && (
        <ElementalPackModal
          element={openingElementalPack}
          packsAvailable={player.elementalPacks?.[openingElementalPack] || 0}
          starmons={starmons}
          onClose={() => setOpeningElementalPack(null)}
          onClaim={handleClaimElementalPack}
        />
      )}

      {/* MODAL: COMMS & CHAT (World, Clan, Private) */}
      {showChatModal && (
        <ChatModal
          player={player}
          messages={chatMessages}
          onSendMessage={handleSendChatMessage}
          onClose={() => setShowChatModal(false)}
        />
      )}
    </div>
  );
}
