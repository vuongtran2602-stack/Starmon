import React, { useState, useRef } from 'react';
import { ElementType, InventoryCategory, InventoryItem, PlayerProfile, Starmon } from '../types';
import { sound } from '../services/sound';
import {
  EQUIPMENT_ITEMS_CATALOG,
  STAR_SHARD_IMAGE,
  GOLDEN_ANVIL_IMAGE,
  ENERGY_BATTERY_50_IMAGE,
  ENERGY_BATTERY_100_IMAGE,
  ENERGY_BATTERY_200_IMAGE,
} from '../data/itemsData';
import {
  X,
  Package,
  Layers,
  Sparkles,
  Award,
  ArrowUp,
  ArrowDown,
  Briefcase,
  Zap,
  Minus,
  Plus,
  Check,
} from 'lucide-react';
import inventoryIconImg from '../assets/icons/inventory_icon.png';
import starterPackImg from '../assets/images/starter_pack.png';
import packWindImg from '../assets/images/pack_wind.png';
import packWaterImg from '../assets/images/pack_water.png';
import packMetalImg from '../assets/images/pack_metal.png';
import packFireImg from '../assets/images/pack_fire.png';
import packElectricImg from '../assets/images/pack_electric.png';
import packEarthImg from '../assets/images/pack_earth.png';

interface Props {
  player: PlayerProfile;
  starmons: Starmon[];
  onClose: () => void;
  onOpenStarterPack: () => void;
  onOpenElementalPack?: (element: ElementType) => void;
  onSelectStarmonTab?: () => void;
  onUseBatteries?: (tier: 50 | 100 | 200, count: number) => void;
}

export const InventoryModal: React.FC<Props> = ({
  player,
  starmons,
  onClose,
  onOpenStarterPack,
  onOpenElementalPack,
  onSelectStarmonTab,
  onUseBatteries,
}) => {
  const [activeTab, setActiveTab] = useState<InventoryCategory>('consumables');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [batterySliderTier, setBatterySliderTier] = useState<50 | 100 | 200 | null>(null);
  const [batterySliderCount, setBatterySliderCount] = useState<number>(1);
  const [toastNotice, setToastNotice] = useState<string | null>(null);
  const inventoryScrollRef = useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    sound.playClick();
    if (inventoryScrollRef.current) {
      inventoryScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToBottom = () => {
    sound.playClick();
    if (inventoryScrollRef.current) {
      inventoryScrollRef.current.scrollTo({ top: inventoryScrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  // 1. CONSUMABLES: ONLY show packs that the user actually owns (> 0)!
  const consumablePacks: InventoryItem[] = [];

  if (player.starterPacksCount > 0) {
    consumablePacks.push({
      id: 'inv_starter_pack',
      name: 'Magical Starter Pack',
      category: 'consumables',
      description: 'Summons 1 new Starmon companion guaranteed! Contains 20 cards and starter upgrade crystals.',
      quantity: player.starterPacksCount,
      rarity: 'legendary',
      icon: '🎁',
      image: starterPackImg,
      actionLabel: 'OPEN PACK',
      subType: 'pack',
    });
  }

  const elementalDefs: { el: ElementType; name: string; img: string; icon: string }[] = [
    { el: 'Wind', name: 'Starmon Wind Pack', img: packWindImg, icon: '💨' },
    { el: 'Water', name: 'Starmon Water Pack', img: packWaterImg, icon: '💧' },
    { el: 'Metal', name: 'Starmon Metal Pack', img: packMetalImg, icon: '⚙️' },
    { el: 'Fire', name: 'Starmon Fire Pack', img: packFireImg, icon: '🔥' },
    { el: 'Electric', name: 'Starmon Electric Pack', img: packElectricImg, icon: '⚡' },
    { el: 'Earth', name: 'Starmon Earth Pack', img: packEarthImg, icon: '🪨' },
  ];

  elementalDefs.forEach(d => {
    const qty = player.elementalPacks?.[d.el] || 0;
    // CRITICAL: Only include if the user actually has the pack!
    if (qty > 0) {
      consumablePacks.push({
        id: `inv_pack_${d.el}`,
        name: d.name,
        category: 'consumables',
        description: `Summons 1 ${d.el} Starmon companion guaranteed (or +50 cards if already owned)!`,
        quantity: qty,
        rarity: 'epic',
        icon: d.icon,
        image: d.img,
        element: d.el,
        actionLabel: 'OPEN PACK',
        subType: 'pack',
      });
    }
  });

  // 2. DEDICATED ITEMS CATEGORY: Star Shard, Golden Anvil, Energy Batteries
  const itemsCategoryList: InventoryItem[] = [
    {
      id: 'item_star_shard',
      name: 'Star Shard',
      category: 'items',
      description: 'Mảnh Sao Tinh Tú quý hiếm. Vật phẩm dùng để Level Up (Nâng cấp cấp độ) các trang bị của Starmon, mở rộng giới hạn chỉ số chiến đấu ATK và HP.',
      quantity: player.specialItems?.starShard || 0,
      rarity: 'epic',
      icon: '⭐',
      image: STAR_SHARD_IMAGE,
      actionLabel: 'NÂNG CẤP TRANG BỊ',
      subType: 'level_up',
    },
    {
      id: 'item_golden_anvil',
      name: 'Golden Anvil',
      category: 'items',
      description: 'Đe Vàng Hoàng Kim cổ đại chứa ma thuật tối thượng. Vật phẩm dùng để Cường Hóa (Enhance) trang bị, kích hoạt hiệu ứng phẩm chất đặc biệt và chỉ số vượt bậc.',
      quantity: player.specialItems?.goldenAnvil || 0,
      rarity: 'legendary',
      icon: '🔨',
      image: GOLDEN_ANVIL_IMAGE,
      actionLabel: 'CƯỜNG HÓA TRANG BỊ',
      subType: 'enhance',
    },
    {
      id: 'item_battery_50',
      name: 'Energy Battery 50 🗲',
      category: 'items',
      description: 'Bình pin năng lượng cơ bản. Hồi phục +50 Energy tức thì cho các hoạt động breeding, hatching, forging và researching.',
      quantity: player.energyBatteries?.battery50 || 0,
      rarity: 'rare',
      icon: '🔋',
      image: ENERGY_BATTERY_50_IMAGE,
      batteryAmount: 50,
      actionLabel: (player.energyBatteries?.battery50 || 0) > 0 ? 'SỬ DỤNG (+50 🗲)' : undefined,
      subType: 'battery',
    },
    {
      id: 'item_battery_100',
      name: 'Energy Battery 100 🗲',
      category: 'items',
      description: 'Bình pin năng lượng cao cấp. Hồi phục +100 Energy tức thì cho các hoạt động breeding, hatching, forging và researching.',
      quantity: player.energyBatteries?.battery100 || 0,
      rarity: 'epic',
      icon: '🔋',
      image: ENERGY_BATTERY_100_IMAGE,
      batteryAmount: 100,
      actionLabel: (player.energyBatteries?.battery100 || 0) > 0 ? 'SỬ DỤNG (+100 🗲)' : undefined,
      subType: 'battery',
    },
    {
      id: 'item_battery_200',
      name: 'Energy Battery 200 🗲',
      category: 'items',
      description: 'Bình pin năng lượng cực đại. Hồi phục +200 Energy tức thì cho các hoạt động breeding, hatching, forging và researching.',
      quantity: player.energyBatteries?.battery200 || 0,
      rarity: 'legendary',
      icon: '⚡',
      image: ENERGY_BATTERY_200_IMAGE,
      batteryAmount: 200,
      actionLabel: (player.energyBatteries?.battery200 || 0) > 0 ? 'SỬ DỤNG (+200 🗲)' : undefined,
      subType: 'battery',
    },
  ];

  // 3. SHARDS & CARDS
  const shardsCategoryList: InventoryItem[] = starmons.map(s => ({
    id: `shard_${s.id}`,
    name: `${s.name} Cards`,
    category: 'shards' as InventoryCategory,
    description: `${s.title} (${s.element} · ${s.role}). Thu thập thẻ từ Rương Chiến Thắng để nâng cấp kỹ năng và chỉ số.`,
    quantity: s.cards,
    rarity: s.unlocked ? ('rare' as const) : ('common' as const),
    icon: s.element === 'Fire' ? '🔥' : s.element === 'Water' ? '🌊' : s.element === 'Earth' ? '🗿' : '⚡',
    actionLabel: s.unlocked ? 'XEM MON' : 'CHƯA MỞ',
    starmonId: s.id,
  }));

  // 4. RESOURCES & EQUIPMENT
  const materialsCategoryList: InventoryItem[] = [
    {
      id: 'res_gems',
      name: 'Gems',
      category: 'materials',
      description: 'Kim cương quý giá dùng để mở các gói nguyên tố và mở khóa trang bị đặc biệt.',
      quantity: player.gems,
      rarity: 'rare',
      icon: '💎',
    },
    {
      id: 'res_gold',
      name: 'Gold',
      category: 'materials',
      description: 'Vàng tiêu chuẩn nhận được khi làm bài tập IELTS và chiến thắng trong trận đấu Match-3.',
      quantity: player.gold,
      rarity: 'common',
      icon: '🪙',
    },
    ...(player.equipmentInventory || [])
      .filter(eq => eq.count > 0)
      .map(eq => {
        const cat = EQUIPMENT_ITEMS_CATALOG[eq.itemId];
        if (!cat) return null;
        return {
          id: `equip_${cat.id}`,
          name: cat.name,
          category: 'materials' as InventoryCategory,
          description: cat.id === 'old_pickaxe' ? '+1% ATK, +1% Max HP' : 'Đồng phục độc quyền trường Đa Phúc. Trang bị cho Aquanymph để kích hoạt bản đặc quyền.',
          quantity: eq.count,
          rarity: cat.rarity || 'common',
          icon: cat.id === 'old_pickaxe' ? '⛏️' : '👔',
          actionLabel: 'TRANG BỊ',
        };
      })
      .filter(Boolean) as InventoryItem[],
  ];

  // Combined Items
  const items: InventoryItem[] = [
    ...consumablePacks,
    ...itemsCategoryList,
    ...shardsCategoryList,
    ...materialsCategoryList,
  ];

  const filteredItems = items.filter(it => it.category === activeTab);
  const activeItem = selectedItem && selectedItem.category === activeTab ? selectedItem : filteredItems[0] || null;

  // Handle action button click
  const handleAction = (item: InventoryItem) => {
    sound.playClick();
    if (item.id === 'inv_starter_pack') {
      if (player.starterPacksCount > 0) {
        onClose();
        onOpenStarterPack();
      }
    } else if (item.id.startsWith('inv_pack_')) {
      const el = item.element || (item.id.replace('inv_pack_', '') as ElementType);
      if ((player.elementalPacks?.[el] || 0) > 0 && onOpenElementalPack) {
        onClose();
        onOpenElementalPack(el);
      }
    } else if (item.batteryAmount) {
      // Open the slider modal for this battery tier
      setBatterySliderTier(item.batteryAmount);
      setBatterySliderCount(1);
    } else if (item.id === 'item_star_shard' || item.id === 'item_golden_anvil') {
      // Direct user to Starmon Equipment screen
      if (onSelectStarmonTab) {
        onClose();
        onSelectStarmonTab();
      } else {
        setToastNotice(`✨ Hãy mở màn hình Đội Hình Starmon để dùng ${item.name}!`);
        setTimeout(() => setToastNotice(null), 3000);
      }
    } else if (item.starmonId) {
      if (onSelectStarmonTab) {
        onClose();
        onSelectStarmonTab();
      }
    } else if (item.id.startsWith('equip_')) {
      if (onSelectStarmonTab) {
        onClose();
        onSelectStarmonTab();
      }
    } else {
      sound.playRewardFanfare();
    }
  };

  // Confirm using battery from inventory
  const handleConfirmBatteryUse = () => {
    if (!batterySliderTier || !onUseBatteries) return;
    const tierKey = batterySliderTier === 50 ? 'battery50' : batterySliderTier === 100 ? 'battery100' : 'battery200';
    const available = player.energyBatteries?.[tierKey] || 0;
    const countToUse = Math.min(batterySliderCount, available);

    if (countToUse <= 0) return;

    sound.playRewardFanfare();
    onUseBatteries(batterySliderTier, countToUse);
    setToastNotice(`⚡ Đã sử dụng ${countToUse}x Energy Battery ${batterySliderTier}🗲 (+${countToUse * batterySliderTier} Energy)!`);
    setTimeout(() => setToastNotice(null), 3000);
    setBatterySliderTier(null);
  };

  const getActiveBatteryMax = () => {
    if (!batterySliderTier) return 0;
    const key = batterySliderTier === 50 ? 'battery50' : batterySliderTier === 100 ? 'battery100' : 'battery200';
    return player.energyBatteries?.[key] || 0;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-indigo-400/80 rounded-3xl p-5 md:p-6 max-w-3xl w-full shadow-2xl text-slate-100 flex flex-col justify-between max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-sky-400 p-0.5 shadow-lg flex items-center justify-center">
              <img
                src={inventoryIconImg}
                alt="Inventory"
                className="w-10 h-10 object-contain drop-shadow"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://www.dropbox.com/scl/fi/pyvtkn67cuk639a97ctay/Inventory-Icon-2.png?rlkey=fkjpjyjbijbc997omjxj04xk8&st=vlju0ndn&raw=1';
                }}
              />
            </div>
            <div>
              <h3 className="text-xl font-black font-game text-white flex items-center gap-2">
                Trainer Inventory & Vault
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/40 font-mono">
                  {items.reduce((acc, i) => acc + (i.quantity > 0 ? 1 : 0), 0)} Items
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Packs, vật phẩm nâng cấp (Star Shard, Golden Anvil), Energy Batteries, cards & resources.
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

        {/* Category Tabs: Consumables (Packs), Items (Vật Phẩm), Cards & Shards, Resources, Crests & Badges */}
        <div className="grid grid-cols-5 gap-1 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 mb-3 shrink-0">
          {[
            { id: 'consumables', label: 'Consumables', icon: <Package className="w-3.5 h-3.5" /> },
            { id: 'items', label: 'Items', icon: <Sparkles className="w-3.5 h-3.5" /> },
            { id: 'shards', label: 'Cards & Shards', icon: <Layers className="w-3.5 h-3.5" /> },
            { id: 'materials', label: 'Resources', icon: <Briefcase className="w-3.5 h-3.5" /> },
            { id: 'badges', label: 'Badges', icon: <Award className="w-3.5 h-3.5" /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                sound.playClick();
                setActiveTab(tab.id as InventoryCategory);
                setSelectedItem(null);
                setBatterySliderTier(null);
              }}
              className={`py-2 px-1 text-[11px] sm:text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white font-black shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              {tab.icon}
              <span className="truncate">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Toast Notice */}
        {toastNotice && (
          <div className="mb-2 p-2 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-200 text-xs font-bold flex items-center gap-2 animate-in fade-in shrink-0">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{toastNotice}</span>
          </div>
        )}

        {/* Content: Grid on Left + Detail Pane on Right */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 overflow-hidden relative">
          {/* Scroll Up & Down Helper Controls */}
          <div className="absolute top-1 left-2 md:left-auto md:right-[34%] z-20 flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 rounded-full p-1 shadow-lg backdrop-blur-sm">
            <button
              onClick={scrollToTop}
              className="p-1 rounded-full bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Scroll Up"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={scrollToBottom}
              className="p-1 rounded-full bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Scroll Down"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Items Grid (2 cols on md) */}
          <div
            ref={inventoryScrollRef}
            className="md:col-span-2 overflow-y-auto pr-1 space-y-2 max-h-[50vh] scroll-smooth pt-7"
          >
            {filteredItems.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center text-slate-500 px-4">
                {activeTab === 'consumables' ? (
                  <>
                    <Package className="w-12 h-12 text-slate-600 mb-2 stroke-1" />
                    <p className="text-sm font-bold text-slate-300">Không có Gói Thẻ nào</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      Mục Consumables chỉ hiển thị các Gói Thẻ khi bạn có sẵn trong kho đồ. Hãy nhận quà Nhiệm vụ hoặc vào Cửa Hàng để mở thêm!
                    </p>
                  </>
                ) : activeTab === 'items' ? (
                  <>
                    <Sparkles className="w-12 h-12 text-slate-600 mb-2 stroke-1" />
                    <p className="text-sm font-bold text-slate-300">Kho Vật Phẩm Trống</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Chưa có vật phẩm nâng cấp hoặc bình năng lượng trong túi.
                    </p>
                  </>
                ) : (
                  <>
                    <Award className="w-12 h-12 text-slate-600 mb-2 stroke-1" />
                    <p className="text-sm font-bold text-slate-400">Vault is empty</p>
                    <p className="text-xs text-slate-500 mt-1">Chưa có vật phẩm trong mục này.</p>
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {filteredItems.map(item => {
                  const isSelected = activeItem?.id === item.id;
                  const itemImg = item.image;

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        sound.playClick();
                        setSelectedItem(item);
                        setBatterySliderTier(null);
                      }}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col items-center justify-between text-center relative group ${
                        isSelected
                          ? 'bg-indigo-950/70 border-indigo-400 shadow-lg shadow-indigo-500/20 scale-102'
                          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                      }`}
                    >
                      {/* Item Icon / Graphic */}
                      <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-3xl mb-2 relative group-hover:scale-105 transition-transform overflow-hidden">
                        {itemImg ? (
                          <img
                            src={itemImg}
                            alt={item.name}
                            className="w-12 h-12 object-contain drop-shadow"
                          />
                        ) : (
                          item.icon
                        )}
                        {item.quantity > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 px-2 py-0.2 rounded-full bg-indigo-600 text-white text-[10px] font-mono font-black border border-white/50 shadow">
                            x{item.quantity}
                          </span>
                        )}
                      </div>

                      <h5 className="font-bold text-xs text-white truncate w-full">
                        {item.name}
                      </h5>

                      <span
                        className={`text-[10px] uppercase font-bold mt-1 px-2 py-0.2 rounded-full ${
                          item.rarity === 'legendary'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                            : item.rarity === 'epic'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-400/40'
                            : item.rarity === 'rare'
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {item.rarity}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Item Detail Inspector on Right */}
          <div className="bg-slate-950/90 rounded-2xl border border-slate-800 p-4 flex flex-col justify-between overflow-y-auto">
            {activeItem ? (
              <div className="space-y-3">
                <div className="flex flex-col items-center text-center pb-3 border-b border-slate-800">
                  <div className="w-18 h-18 rounded-3xl bg-slate-900 border-2 border-indigo-400/50 flex items-center justify-center text-4xl mb-2 shadow-lg overflow-hidden p-1.5">
                    {activeItem.image ? (
                      <img
                        src={activeItem.image}
                        alt={activeItem.name}
                        className="max-h-full max-w-full object-contain drop-shadow"
                      />
                    ) : (
                      activeItem.icon
                    )}
                  </div>
                  <h4 className="font-black font-game text-base text-white">
                    {activeItem.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-400/30">
                      Số lượng: {activeItem.quantity}
                    </span>
                    <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {activeItem.rarity}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  {activeItem.description}
                </div>

                {/* Energy Battery Slider Panel (when opened) */}
                {batterySliderTier && getActiveBatteryMax() > 0 ? (
                  <div className="p-3 rounded-xl bg-slate-900 border-2 border-amber-400/80 space-y-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-amber-300 font-mono">1</span>
                      <span className="text-white font-game bg-slate-800 px-2 py-0.5 rounded-lg border border-amber-400/50">
                        {batterySliderCount} / {getActiveBatteryMax()} bình
                      </span>
                      <span className="text-amber-300 font-mono">{getActiveBatteryMax()} (n)</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          sound.playClick();
                          setBatterySliderCount(c => Math.max(1, c - 1));
                        }}
                        disabled={batterySliderCount <= 1}
                        className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white flex items-center justify-center font-bold"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="range"
                        min={1}
                        max={getActiveBatteryMax()}
                        value={batterySliderCount}
                        onChange={(e) => setBatterySliderCount(Number(e.target.value))}
                        className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none accent-amber-400 cursor-pointer"
                      />
                      <button
                        onClick={() => {
                          sound.playClick();
                          setBatterySliderCount(c => Math.min(getActiveBatteryMax(), c + 1));
                        }}
                        disabled={batterySliderCount >= getActiveBatteryMax()}
                        className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white flex items-center justify-center font-bold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-[11px] text-center text-slate-300 font-bold bg-slate-950/60 p-1.5 rounded-lg border border-slate-800">
                      Nạp thêm: <span className="text-amber-300 font-mono">+{batterySliderCount * batterySliderTier} 🗲</span> | Sau khi nạp: <span className="text-emerald-300 font-mono">{player.energy + batterySliderCount * batterySliderTier} 🗲</span>
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setBatterySliderTier(null)}
                        className="flex-1 py-1.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={handleConfirmBatteryUse}
                        className="flex-[2] py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 text-slate-950 font-black font-game text-xs rounded-lg shadow cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Xác Nhận Nạp
                      </button>
                    </div>
                  </div>
                ) : (
                  activeItem.actionLabel && (
                    <button
                      onClick={() => handleAction(activeItem)}
                      className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-400 hover:to-sky-400 text-white font-black font-game text-xs rounded-xl shadow-lg transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-4 h-4" />
                      {activeItem.actionLabel}
                    </button>
                  )
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                Chọn một vật phẩm để xem chi tiết.
              </div>
            )}

            <div className="text-center text-[10px] text-slate-500 pt-2 border-t border-slate-800">
              Inventory tự động đồng bộ với hồ sơ huấn luyện viên
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-3 mt-3 shrink-0">
          <span className="text-[11px] text-slate-400 flex items-center gap-2">
            <span>Gold: {player.gold.toLocaleString()} G</span>
            <span>·</span>
            <span>Gems: {player.gems.toLocaleString()} 💎</span>
            <span>·</span>
            <span className="text-amber-300 font-bold">Energy: {player.energy}/100 🗲</span>
          </span>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
