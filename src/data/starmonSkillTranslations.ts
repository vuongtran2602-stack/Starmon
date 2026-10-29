type SkillSlot = 'passive' | 'skill1' | 'skill2';
type SkillTranslations = Partial<Record<SkillSlot, string>>;

// Vietnamese explanations for skills whose English description contains multiple effects.
const VIETNAMESE_SKILL_DESCRIPTIONS: Record<string, SkillTranslations> = {
  coralus: { passive: 'Khi Coralus còn trên 50% HP, giảm 15% sát thương nhận vào cho bản thân và toàn đội.', skill1: '• Tấn công mục tiêu bằng hai móng vuốt phủ nước, gây 180% sát thương.\n• Giảm 25% DEF của mục tiêu trong 2 lượt.', skill2: 'Tạo khiên nước hấp thụ sát thương cho toàn đội trong 3 lượt.' },
  pyrokit: { passive: 'Đòn tấn công có 35% tỉ lệ gây Burn lên kẻ địch, khiến chúng chịu sát thương mỗi vòng.', skill1: '• Ném cầu lửa gây 200% sát thương Fire.\n• Gây 350% sát thương nếu mục tiêu đang bị Burn.', skill2: 'Triệu hồi lốc lửa cáo, gây 180% sát thương Fire diện rộng lên toàn bộ kẻ địch.' },
  ignisaur: { passive: 'Nhận thêm 30% Base ATK khi HP hiện tại giảm xuống dưới 50%.', skill1: 'Thực hiện hai nhát chém liên tiếp, mỗi nhát gây sát thương bằng 85% ATK.', skill2: 'Giáng magma lên đối thủ, gây 240% sát thương Fire và đảm bảo gây Burn (30%).' },
  tidecrush: {
    passive: '• Đòn tấn công khi ghép Match-3 hồi HP bằng 10% Max HP của Tidecrush.\n• Nếu Tidecrush đầy HP, thay vào đó nhận thêm 10 Mana.',
    skill1: 'Chém đối thủ bằng hai dao găm băng, gây 175% sát thương Water.',
    skill2: '• Chuyển toàn bộ Mana hiện có thành ATK cộng thêm (1 Mana = +0,2% Base ATK) trong 3 lượt.\n• Hồi chiêu 3 lượt và không gây sát thương trực tiếp.',
  },
  glidron: {
    passive: 'Nhận thêm 2 Mana mỗi khi bất kỳ bên nào tiêu thụ orb Wind hoặc Electric.',
    skill1: '• Bắn luồng điện tập trung, gây 180% sát thương.\n• Gây Silence lên mục tiêu.',
    skill2: '• Gây 320% sát thương Electric diện rộng và Stun kẻ địch trong 1 lượt.\n• Hy sinh 30% HP hiện tại của Glidron.',
  },
  voltlynx: { passive: '• Đòn tấn công có thêm 25% tỉ lệ chí mạng.\n• Đòn đánh và kỹ năng chí mạng gây thêm 25% sát thương.', skill1: 'Gây 110% sát thương Electric với thêm 25% tỉ lệ chí mạng.', skill2: '• Gọi xuống 3 tia sét, mỗi tia gây 120% sát thương.\n• Mỗi tia chọn ngẫu nhiên một mục tiêu địch.' },
  obsidus: { passive: 'Đòn đánh vật lý và kỹ năng có thêm 30% tỉ lệ chí mạng.', skill1: '• Nhận Piercing trong 2 lượt, bỏ qua 50% DEF của mục tiêu.\n• Vẫn có thể di chuyển trong lượt này.', skill2: 'Làm nứt mặt đất dưới tuyến trước của đối thủ, gây 280% sát thương Earth.' },
  stone_golem: {
    passive: '• Nhận Khiên bằng 5% Max HP vào đầu mỗi vòng.\n• Khi bị hạ, cấp cho toàn đội Khiên bằng 25% Max HP của Stone Golem trong 3 lượt.',
    skill1: '• Gây 120% sát thương vật lý Earth lên một kẻ địch.\n• Có 30% tỉ lệ khiến mục tiêu bị Stun.',
    skill2: '• Khiêu khích tất cả kẻ địch trong 2 lượt, buộc đòn đánh và kỹ năng đơn mục tiêu nhắm vào Stone Golem.\n• Lập tức nhận Khiên bằng 18% Max HP trong 2 lượt.',
  },
  aquanymph: {
    passive: 'Hồi 8% Max HP mỗi lượt cho đồng minh có HP thấp nhất.',
    skill1: '• Gây 180% sát thương Water, có 20% tỉ lệ gây Frostbite trong 3 lượt.\n• Nếu mục tiêu đã bị Frostbite, gây Silence trong 1 lượt.',
    skill2: '• Hồi 160 HP cho toàn đội.\n• Xóa các hiệu ứng bất lợi khỏi đồng minh.',
  },
  teslarion: { passive: 'Nhận thêm 5 Mana mỗi khi ghép orb Electric.', skill1: 'Tăng 25% ATK cho toàn đội trong 2 vòng.', skill2: 'Phóng luồng năng lượng gây 210% sát thương Electric và Metal diện rộng.' },
  moltenback: { passive: '• Phản lại 20% sát thương vật lý nhận vào.\n• Sát thương phản lại mang hiệu ứng Burn thuộc hệ Fire.', skill1: 'Phun dung nham đang cháy, gây 150% sát thương Fire.', skill2: 'Trút xỉ nóng chảy và mảnh kim loại xuống, gây 230% sát thương Fire và Steel diện rộng.' },
  frostmoth: { passive: 'Kỹ năng Water và Wind của đồng minh có 10% tỉ lệ gây Frostbite lên kẻ địch trong 1 lượt, làm giảm 10% ATK.', skill1: 'Rải băng sắc, gây 170% sát thương Wind.', skill2: 'Triệu hồi bão tuyết, gây 180% sát thương Wind diện rộng.' },
  zapwing: { passive: 'Tăng 10% ATK mỗi khi Zapwing nhận sát thương từ đòn đánh hoặc kỹ năng.', skill2: 'Đập cánh tạo nên bão xoáy sấm sét và gió, gây 220% sát thương Electric lên toàn bộ kẻ địch.' },
  zapwing: { skill1: '• Lao vào một mục tiêu bằng chiếc mỏ tích điện, gây 135% sát thương Electric.\n• Có 35% tỉ lệ khiến mục tiêu bị Stun.' },
  vinedra: {
    passive: '• Đòn tấn công kích hoạt bởi orb Earth và Active Skill có 35% tỉ lệ gây Poison lên mục tiêu trong 2 lượt.\n• Poison giảm 10% DEF và gây sát thương bằng 5% Max HP sau lượt của mục tiêu.',
    skill1: '• Gây 70% sát thương Earth và tăng 20% tỉ lệ chí mạng cho đòn đánh cùng kỹ năng.\n• Nếu còn ít nhất 25 Mana, Vinedra có thể dùng lại Thorn Whip trong lượt này.',
    skill2: '• Gây 85% sát thương Earth lên toàn bộ kẻ địch.\n• Mỗi kẻ địch có 35% tỉ lệ bị Poison.',
  },
  bubbleboon: {
    passive: '• Nhận hiệu ứng Resonance vĩnh viễn.\n• Bubbleboon không mất lượt khi sử dụng kỹ năng.',
    skill1: '• Nhận Double Strike trong 1 lượt.\n• Có thể đổi orb liên tiếp thay vì chỉ một lần.',
    skill2: '• Gây 180% sát thương vật lý Water và đổi 3 orb không phải Water ngẫu nhiên thành orb Water.\n• Nếu việc đổi orb tạo thành nhóm từ 3 orb Water liên kết, gây thêm sát thương bằng 100% ATK.',
  },
  trojan_flare: {
    passive: '• Khi đang có Khiên, Trojan Flare nhận thêm 10% ATK (tính theo Base ATK) và Piercing.\n• Phần ATK cộng thêm mất đi khi Khiên hết hạn hoặc bị phá.',
    skill1: '• Nhận Clarity, miễn nhiễm Stun, Frostbite, Burn và Poison.\n• Nhận Resonance trong 1 lượt, bắt đầu từ lượt kế tiếp.',
    skill2: '• Nhận Khiên bằng 220% ATK hiện tại.\n• Khiên này không hết hạn và chỉ bị phá khi chịu sát thương.',
  },
  cyborgnid: { passive: 'Lò phản ứng bên trong hấp thụ năng lượng từ va chạm; nhận 10 Mana mỗi khi bị đòn đánh hoặc kỹ năng của kẻ địch gây sát thương.', skill1: 'Chém mục tiêu bằng vuốt thép, gây 130% sát thương Steel.', skill2: '• Nhận Khiên bằng 20% Max HP trong 3 lượt.\n• Bắn tia laser gây sát thương Steel bằng 30% lượng sát thương đã nhận.' },
  mineacle: { passive: '• Khi bị đòn đánh hoặc kỹ năng trúng, tự động phản công và phản lại 20% sát thương cho kẻ tấn công.\n• Khi bị hạ, phát nổ gây sát thương bằng 10% Max HP của Mineacle lên toàn bộ kẻ địch.', skill1: 'Vung dây xích nặng đập vào mục tiêu, gây 170% sát thương Water.', skill2: '• Nhận Taunt trong 3 lượt.\n• Nhận Khiên bằng 50% Max HP trong 3 lượt.' },
  zephyrion: {
    passive: '• Zephyrion và đồng minh gây thêm 10% sát thương bằng đòn đánh và kỹ năng Wind.\n• Nhận Clarity, miễn nhiễm Burn, Stun, Taunt, Frostbite và Poison.',
    skill1: '• Gây 125% sát thương Wind lên mục tiêu.\n• Sát thương tăng gấp đôi nếu mục tiêu có nhiều HP hơn Zephyrion.',
    skill2: '• Kẻ địch đang có ít nhất 1 debuff khi kỹ năng được kích hoạt sẽ nhận sát thương gấp đôi từ kỹ năng này.\n• Gây 120% sát thương Wind diện rộng lên toàn bộ kẻ địch.\n• Xóa mọi buff và debuff khỏi toàn bộ kẻ địch.',
  },
  mossloth: { passive: 'Khi HP dưới 50% Max HP, có 20% tỉ lệ né đòn đánh thường hoặc kỹ năng đơn mục tiêu nhắm vào mình.', skill1: 'Gây sát thương Earth bằng 15% Max HP của bản thân.', skill2: '• Nhận Taunt trong 3 lượt.\n• Hồi HP bằng 15% Max HP vào cuối mỗi lượt.' },
  khepri: {
    passive: 'Sau khi sử dụng kỹ năng, nhận 30% Evasiveness trong 1 lượt. Hiệu ứng Evasiveness không cộng dồn.',
    skill1: '• Gây sát thương Earth bằng 10% HP hiện tại của mục tiêu.\n• Áp dụng Healing Block trong 2 lượt, ngăn mọi nguồn hồi HP.',
    skill2: '• Triệu hồi hiệu ứng Sun trên toàn bàn đấu trong 3 lượt.\n• Khi Sun đang hoạt động, sát thương Water giảm 20% và sát thương Fire tăng 20%.\n• Khepri tăng 20% ATK và kích hoạt nội tại Desert Shroud.',
  },
  cottontail: {
    passive: 'Mỗi khi bị đòn đánh hoặc kỹ năng trúng, khiến ATK của kẻ tấn công giảm 5%.',
    skill1: '• Gây sát thương Wind bằng 160% ATK của Cottontail.\n• Phá Khiên của mục tiêu.',
    skill2: '• Nhận Taunt trong 3 lượt.\n• Giảm 15% sát thương phải chịu trong 3 lượt.',
  },
  dreadhorn: { passive: 'Mỗi khi bị đòn đánh hoặc kỹ năng trúng, Base DEF tăng 5%.', skill1: 'Gây sát thương Steel bằng 50% DEF của Dreadhorn.', skill2: '• Nhận Taunt trong 3 lượt.\n• Tăng 20% DEF trong 3 lượt.' },
  bambloom: { passive: '• Mỗi đồng minh chỉ kích hoạt một lần mỗi trận khi HP giảm dưới 30%; hồi 15% Base HP cho đồng minh đó.\n• Nếu Bambloom tự kích hoạt, hồi 30% Base HP.', skill1: 'Gây sát thương Earth bằng 180% ATK của Bambloom lên toàn bộ kẻ địch.', skill2: 'Hồi HP cho đồng minh có phần trăm HP thấp nhất bằng 50% lượng HP đã mất.' },
};

export function getStarmonSkillDescription(
  starmonId: string,
  slot: SkillSlot,
  englishDescription: string,
  language: 'English' | 'Tiếng Việt',
): string {
  if (language === 'English') return englishDescription;
  return VIETNAMESE_SKILL_DESCRIPTIONS[starmonId]?.[slot] || englishDescription;
}
