import { VietnameseSpeakingAnalysis } from '../types';

export const VIETNAMESE_SPEAKING_ANALYSIS_MAP: Record<string, VietnameseSpeakingAnalysis> = {
  // Question 1: Reading books
  'Do you like reading books? What kind of books do you prefer?': {
    grammarMistakes: [
      {
        title: 'Thiếu số nhiều ở danh từ đếm được (Books / Novels)',
        where: 'Trong cụm từ "I like read book" hoặc "I prefer fantasy book"',
        mistake: 'Quên thêm đuôi số nhiều "-s" hoặc dùng sai động từ sau "like" ("like read" thay vì "like reading / like to read").',
        why: 'Trong tiếng Anh, danh từ đếm được chỉ sở thích nói chung phải ở dạng số nhiều ("books", "novels"). Sau "like" cần V-ing hoặc To-V.',
        solution: 'Sửa thành: "I like reading books" hoặc "I am keen on reading fantasy novels".',
      },
      {
        title: 'Dùng sai cấu trúc so sánh với động từ "Prefer"',
        where: 'Câu nói so sánh giữa 2 loại sách ("prefer A than B")',
        mistake: 'Dùng "prefer... than..." (thói quen dịch từ "thích hơn" trong tiếng Việt).',
        why: '"Prefer" đi với giới từ "TO", không dùng "than" như trong so sánh hơn.',
        solution: 'Sửa thành: "I prefer reading fiction books TO non-fiction ones".',
      },
    ],
    pronunciationMistakes: [
      {
        title: 'Nuốt âm đuôi (Ending sound) /ks/ trong "books" và /t/ trong "prefer"',
        where: 'Từ "books" (/bʊks/) và "adventurous" (/ədˈven.tʃər.əs/)',
        mistake: 'Người Việt thường bỏ rơi phụ âm đuôi /ks/ thành "búc", làm người nghe không phân biệt được số ít hay số nhiều.',
        why: 'Tiếng Việt là ngôn ngữ đơn âm tiết không có phụ âm bật đuôi kết hợp, dẫn đến thói quen nuốt âm cuối.',
        solution: 'Bật rõ âm /k/ rồi chuyển nhẹ sang /s/: /bʊks/. Chú ý âm đuôi giúp tăng ngay điểm Pronunciation!',
      },
      {
        title: 'Phát âm sai nguyên âm ngắn /ʊ/ trong "book" thành /u:/ (u dài)',
        where: 'Từ "book", "look", "good"',
        mistake: 'Đọc kéo dài môi thành "buuuk" (/bu:k/).',
        why: 'Âm /ʊ/ là nguyên âm lỏng (lax vowel), môi hơi mở, phát âm dứt khoát từ vòm họng.',
        solution: 'Giữ môi hơi tròn nhẹ, phát âm nhanh và gọn: /bʊk/.',
      },
    ],
    vietnameseTips: [
      'Nên mở rộng câu bằng công thức "Yes, absolutely + lí do vì sao thích + ví dụ loại sách".',
      'Thay vì lặp lại từ "like", hãy dùng các cụm tự nhiên như "I am an avid reader", "I have a penchant for...".',
    ],
  },

  // Question 2: Morning vs night study
  'Do you prefer studying in the morning or at night? Why?': {
    grammarMistakes: [
      {
        title: 'Nhầm lẫn giới từ chỉ thời gian: "in the morning" vs "at night"',
        where: 'Cụm từ chỉ buổi trong ngày ("in night" hoặc "at morning")',
        mistake: 'Nói "in the night" (khi nói thói quen học) hoặc "at the morning".',
        why: 'Quy tắc cố định: "in the morning / in the afternoon", nhưng với ban đêm khi nói thời điểm chung là "at night".',
        solution: 'Dùng chuẩn: "in the morning" và "at night" (ví dụ: "I study best in the morning rather than at night").',
      },
      {
        title: 'Thiếu mạo từ hoặc dùng sai thể động từ sau "allow/help"',
        where: 'Câu giải thích lí do: "It help me concentrate"',
        mistake: 'Quên chia động từ ngôi thứ ba số ít ("help" thay vì "helps") và thiếu tân ngữ.',
        why: 'Chủ ngữ "It" hoặc danh động từ "Studying early" là ngôi thứ ba số ít, động từ phải thêm "-s".',
        solution: 'Sửa thành: "Studying early HELPS me concentrate better".',
      },
    ],
    pronunciationMistakes: [
      {
        title: 'Sai trọng âm từ "prefer" và "distraction"',
        where: 'Từ "prefer" (/prɪˈfɜːr/) và "distraction" (/dɪˈstræk.ʃən/)',
        mistake: 'Đọc nhấn vào âm tiết đầu "PRE-fer" thay vì âm thứ 2.',
        why: '"Prefer" là động từ 2 âm tiết, trọng âm rơi vào âm tiết thứ 2.',
        solution: 'Nhấn mạnh âm 2: pre-FER /prɪˈfɜːr/, hạ giọng ở âm "pre".',
      },
      {
        title: 'Nuốt phụ âm tổ hợp /st/ trong "study" và "distraction"',
        where: 'Âm đầu /st/ trong "study", "student"',
        mistake: 'Chỉ đọc thành "tơ-đi" hoặc "sơ-tơ-đi", thiếu sự liền mạch của cụm /st/.',
        why: 'Cần khép răng xì nhẹ âm /s/ rồi chuyển mượt mà ngay sang bật âm /t/.',
        solution: 'Luyện /s/ -> /tʌdi/: /ˈstʌd.i/.',
      },
    ],
    vietnameseTips: [
      'Tận dụng các thành ngữ ghi điểm như "early bird" (người dậy sớm) hoặc "night owl" (cú đêm).',
      'Đưa ra lí do thực tế: "my brain is sharpest" (đầu óc tỉnh táo nhất) hoặc "peaceful atmosphere" (không gian yên tĩnh).',
    ],
  },

  // Question 3: Music & Relaxation
  'What kind of music do you usually listen to when you want to relax?': {
    grammarMistakes: [
      {
        title: 'Thiếu giới từ "TO" sau động từ "Listen"',
        where: 'Câu nói: "I usually listen music" hoặc "I listen classical"',
        mistake: 'Nói trực tiếp "listen music" mà không có giới từ "to".',
        why: '"Listen" là nội động từ khi có tân ngữ theo sau bắt buộc phải có giới từ "to" ("listen to something").',
        solution: 'Sửa thành: "I usually listen TO pop music / acoustic melodies".',
      },
      {
        title: 'Dùng sai từ loại: "relax" (động từ) vs "relaxing" (tính từ)',
        where: 'Câu nói: "This music is very relax"',
        mistake: 'Dùng động từ "relax" vào vị trí tính từ sau to-be ("is very relax").',
        why: 'Miêu tả tính chất của bản nhạc phải dùng tính từ đuôi -ing: "relaxing".',
        solution: 'Sửa thành: "This kind of music is extremely RELAXING" hoặc "It helps me relax".',
      },
    ],
    pronunciationMistakes: [
      {
        title: 'Phát âm sai âm /z/ trong "music" thành /s/',
        where: 'Từ "music" (/ˈmjuː.zɪk/)',
        mistake: 'Đọc thành "miu-xích" (âm /s/ vô thanh) thay vì âm /z/ có rung dây thanh quản.',
        why: 'Chữ cái "s" đứng giữa 2 nguyên âm trong "music" phát âm là /z/.',
        solution: 'Phát âm /z/ có độ rung ở cổ họng: /ˈmjuː.zɪk/.',
      },
      {
        title: 'Bỏ quên âm đuôi /st/ trong "acoustic" hoặc /ks/ trong "relax"',
        where: 'Từ "relax" (/rɪˈlæks/)',
        mistake: 'Đọc là "ri-lắc", thiếu phụ âm gió /ks/ ở cuối từ.',
        why: 'Âm "x" ở cuối từ phát âm là /ks/. Cần bật nhẹ /k/ rồi xì /s/.',
        solution: 'Đọc rõ /rɪˈlæks/.',
      },
    ],
    vietnameseTips: [
      'Ghi điểm bằng cách phân loại âm nhạc: "upbeat songs" (nhạc sôi động), "ambient acoustic" (nhạc mộc mạc thư thái), "instrumental" (nhạc không lời).',
      'Dùng cụm hay: "unwind my mind", "let my hair down", "wash away fatigue".',
    ],
  },

  // Question 4: Hometown
  'Describe your hometown. What is the most memorable aspect of it?': {
    grammarMistakes: [
      {
        title: 'Dùng sai thì Quá khứ thay vì Hiện tại khi miêu tả quê hương',
        where: 'Câu: "My hometown was a peaceful village" (khi quê hương vẫn đang tồn tại)',
        mistake: 'Dùng "was / had" khi đang miêu tả hiện trạng của quê nhà.',
        why: 'Miêu tả đặc điểm hiện tại của một địa điểm cần dùng thì Hiện tại đơn (Present Simple).',
        solution: 'Sửa thành: "My hometown IS a coastal city with picturesque landscapes".',
      },
      {
        title: 'Lỗi trật tự tính từ và danh từ ghép',
        where: 'Cụm từ: "seafood fresh delicious" hoặc "people hospitable"',
        mistake: 'Đặt tính từ sau danh từ theo thói quen tiếng Việt ("hải sản tươi ngon").',
        why: 'Trong tiếng Anh, tính từ miêu tả bắt buộc đứng TRƯỚC danh từ.',
        solution: 'Sửa thành: "delicious fresh seafood", "warm and hospitable residents".',
      },
    ],
    pronunciationMistakes: [
      {
        title: 'Phát âm sai âm /θ/ trong "breathtaking" hoặc /h/ trong "hospitable"',
        where: 'Từ "breathtaking" (/ˈbreθˌteɪ.kɪŋ/) và "aspect" (/ˈæs.pekt/)',
        mistake: 'Đọc "breathe" thay vì /breθ/ (âm vô thanh) hoặc nuốt âm /t/ trong "aspect".',
        why: 'Âm /θ/ cần đặt đầu lưỡi giữa 2 hàm răng và thổi luồng hơi nhẹ ra ngoài.',
        solution: 'Để lưỡi kẹp nhẹ giữa 2 răng: /ˈbreθˌteɪ.kɪŋ/. Âm "aspect" bật nhẹ /kt/: /ˈæs.pekt/.',
      },
      {
        title: 'Sai trọng âm từ "memorable"',
        where: 'Từ "memorable" (/ˈmem.ər.ə.bəl/)',
        mistake: 'Nhiều người đọc nhấn âm 2: "me-MO-ra-ble".',
        why: 'Trọng âm chuẩn rơi vào âm tiết đầu tiên (âm 1).',
        solution: 'Nhấn mạnh: /ˈMEM-ər-ə-bəl/.',
      },
    ],
    vietnameseTips: [
      'Hãy nêu vị trí địa lý + 1 điểm ấn tượng nhất (con người, ẩm thực, hoặc cảnh quan thiên nhiên).',
      'Từ vựng Band cao: "tranquil countryside", "bustling metropolitan area", "warm hospitality".',
    ],
  },

  // Question 5: Nature vs Indoors
  'Do you enjoy spending your free time outdoors in nature or indoors?': {
    grammarMistakes: [
      {
        title: 'Dùng sai động từ sau "enjoy" và "spend time"',
        where: 'Cụm từ: "I enjoy to go outside" hoặc "spend time to relax"',
        mistake: 'Dùng To-V sau "enjoy" và "spend time".',
        why: 'Cấu trúc bắt buộc: ENJOY + V-ing và SPEND TIME + V-ing (không dùng to-infinitive).',
        solution: 'Sửa thành: "I enjoy SPENDING time outdoors" và "I spend weekends HIKING".',
      },
      {
        title: 'Nhầm lẫn giữa "outdoor" (tính từ) và "outdoors" (trạng từ)',
        where: 'Câu: "I love staying outdoor"',
        mistake: 'Thiếu âm "s" trong trạng từ "outdoors".',
        why: '"Outdoor" là tính từ (outdoor activities), còn nơi chốn là trạng từ "outdoors".',
        solution: 'Sửa thành: "I prefer staying OUTDOORS" hoặc "participating in OUTDOOR games".',
      },
    ],
    pronunciationMistakes: [
      {
        title: 'Phát âm sai từ "nature" (/ˈneɪ.tʃər/) vs "natural" (/ˈnætʃ.ər.əl/)',
        where: 'Từ "nature" và "natural"',
        mistake: 'Đọc "nature" thành "na-tu-re" hoặc nhầm nguyên âm /eɪ/ với /æ/.',
        why: 'Chữ "a" trong "nature" là nguyên âm đôi /eɪ/, còn trong "natural" là /æ/.',
        solution: 'Đọc chuẩn: "nature" là /ˈneɪ.tʃər/ (nây-chờ), "natural" là /ˈnætʃ.ər.əl/.',
      },
      {
        title: 'Nuốt âm đuôi /ʃ/ trong "fresh" và /t/ trong "activity"',
        where: 'Cụm "fresh air" (/freʃ er/)',
        mistake: 'Đọc "phét e" thay vì cong môi xì âm /ʃ/ dày dặn.',
        why: 'Âm /ʃ/ cần tròn môi và đẩy luồng hơi liên tục qua kẽ răng.',
        solution: 'Tròn môi xì rõ: /freʃ er/.',
      },
    ],
    vietnameseTips: [
      'Nói về lợi ích của thiên nhiên: "recharge my batteries", "immerse myself in lush greenery".',
      'Đưa ra sự cân bằng: "During weekdays I am indoors, but on weekends I head out into nature".',
    ],
  },

  // Question 6: Social media
  'How often do you use social media, and what do you primarily use it for?': {
    grammarMistakes: [
      {
        title: 'Dùng sai cấu trúc "use something for + V-ing / to V"',
        where: 'Câu: "I use social media for chat with friends"',
        mistake: 'Dùng động từ nguyên mẫu sau giới từ "for" ("for chat").',
        why: 'Sau bất kỳ giới từ nào (for, in, at, about...), động từ bắt buộc phải ở dạng V-ing.',
        solution: 'Sửa thành: "I use social media FOR CHATTING with friends" hoặc "TO CHAT with friends".',
      },
      {
        title: 'Thiếu mạo từ trước danh từ số ít hoặc dùng sai trạng từ chỉ tần suất',
        where: 'Vị trí trạng từ chỉ tần suất: "I use daily social media"',
        mistake: 'Đặt trạng từ "daily / often" sai vị trí trong câu.',
        why: 'Trạng từ tần suất đứng trước động từ thường hoặc ở cuối câu.',
        solution: 'Sửa thành: "I use social media ON A DAILY BASIS" hoặc "I often access social media platforms".',
      },
    ],
    pronunciationMistakes: [
      {
        title: 'Phát âm sai từ "media" và "primarily"',
        where: 'Từ "media" (/ˈmiː.di.ə/) và "primarily" (/praɪˈmer.əl.i/)',
        mistake: 'Đọc "mê-đi-a" theo cách Việt hóa thay vì âm /i:/ dài.',
        why: 'Âm tiết đầu của "media" là /mi:/ (kéo dài và bẹt miệng).',
        solution: 'Đọc chuẩn: /ˈmiː.di.ə/. Với "primarily", nhấn âm 2: /praɪˈmer.əl.i/.',
      },
      {
        title: 'Nuốt âm đuôi /ks/ trong "platforms" và "interact"',
        where: 'Từ "platforms" (/ˈplæt.fɔːmz/) và "facebook"',
        mistake: 'Bỏ âm đuôi /z/ ở danh từ số nhiều "platforms".',
        why: 'Thiếu âm số nhiều khiến câu bị trừ điểm cả về ngữ pháp lẫn phát âm.',
        solution: 'Ngân nhẹ âm /z/ ở cuối từ: /ˈplæt.fɔːmz/.',
      },
    ],
    vietnameseTips: [
      'Cụm từ ghi điểm: "keep abreast of the latest news" (cập nhật tin tức), "stay in touch with distant relatives".',
      'Đề cập cả mặt tích cực lẫn thời gian kiểm soát: "I try to limit screen time to avoid addiction".',
    ],
  },

  // Question 7: Food & Cooking
  'Do you enjoy cooking meals for your friends and family?': {
    grammarMistakes: [
      {
        title: 'Dùng sai từ "cook" (vừa là động từ vừa là danh từ chỉ người nấu bếp)',
        where: 'Câu: "I am a good cooker"',
        mistake: 'Nói "good cooker" để tự nhận mình nấu ăn giỏi.',
        why: '"Cooker" trong tiếng Anh là "nồi cơm điện / bếp lò", còn người nấu ăn là "cook".',
        solution: 'Sửa thành: "I am a pretty good COOK" hoặc "I am skilled at cooking".',
      },
      {
        title: 'Thiếu mạo từ hoặc dùng sai danh từ không đếm được "food/delicacy"',
        where: 'Câu: "I cook many delicious foods"',
        mistake: 'Dùng "foods" bừa bãi khi chỉ các món ăn nói chung.',
        why: '"Food" là danh từ không đếm được. Để chỉ món ăn cụ thể, nên dùng "dishes" hoặc "delicacies".',
        solution: 'Sửa thành: "I cook a variety of delicious DISHES for my family".',
      },
    ],
    pronunciationMistakes: [
      {
        title: 'Phát âm sai âm /tʃ/ trong "delicious" (/dɪˈlɪʃ.əs/) và "recipe" (/ˈres.ə.pi/)',
        where: 'Từ "delicious" và "recipe"',
        mistake: 'Đọc "recipe" thành "rì-xai-pờ" hoặc "đì-li-xớt".',
        why: '"Recipe" có 3 âm tiết /ˈres.ə.pi/, trọng âm 1. "Delicious" có âm /ʃ/ cong lưỡi.',
        solution: 'Đọc chuẩn: /ˈres.ə.pi/ (ré-sờ-pi) và /dɪˈlɪʃ.əs/.',
      },
      {
        title: 'Nuốt âm đuôi /d/ trong "home-cooked" và /lz/ trong "meals"',
        where: 'Cụm "home-cooked meals"',
        mistake: 'Đọc thành "hôm cúc miu" làm mất hoàn toàn tính từ phân từ -ed.',
        why: 'Âm đuôi "-ed" sau /k/ đọc là /t/: /hoʊm.kʊkt/. Từ "meals" kết thúc bằng /lz/.',
        solution: 'Bật nhẹ âm /t/ sau "cooked": /hoʊm-kʊkt miːlz/.',
      },
    ],
    vietnameseTips: [
      'Thành ngữ ấn tượng: "whip up a hearty meal" (nấu một bữa ăn thịnh soạn), "therapeutic hobby" (sở thích giúp chữa lành).',
      'Kể một món sở trường cụ thể: "My signature dish is traditional Vietnamese Pho".',
    ],
  },

  // Question 8: Festivals & Celebrations
  'What is your favorite festival or celebration in your country?': {
    grammarMistakes: [
      {
        title: 'Dùng sai thì khi nói về nguồn gốc hoặc hoạt động lễ hội',
        where: 'Câu: "In Tet, people were gathering to celebrate"',
        mistake: 'Dùng thì Quá khứ tiếp diễn cho phong tục lặp đi lặp lại hàng năm.',
        why: 'Phong tục và hoạt động ngày lễ là chân lý/thói quen lặp lại, phải dùng thì Hiện tại đơn.',
        solution: 'Sửa thành: "During Tet, family members GATHER to exchange wishes and gifts".',
      },
      {
        title: 'Dùng sai giới từ chỉ dịp lễ: "AT" vs "ON"',
        where: 'Cụm từ chỉ thời gian: "in Tet Holiday" hoặc "at New Year Eve"',
        mistake: 'Nhầm lẫn giữa "At Christmas / At Tet" (cả kỳ nghỉ) và "On New Year\'s Day" (ngày cụ thể).',
        why: 'Với cả kỳ nghỉ chung dùng "AT Tet / AT Christmas", với ngày cụ thể có chữ "Day/Eve" dùng "ON".',
        solution: 'Sửa thành: "AT Tet" hoặc "ON New Year\'s Eve".',
      },
    ],
    pronunciationMistakes: [
      {
        title: 'Phát âm sai trọng âm từ "celebration" và "festival"',
        where: 'Từ "celebration" (/ˌsel.əˈbreɪ.ʃən/) và "festival" (/ˈfes.tə.vəl/)',
        mistake: 'Nhấn sai âm tiết trong "celebration" (phải nhấn âm 3 "-brei-").',
        why: 'Quy tắc: Các từ có đuôi "-tion" trọng âm luôn rơi vào âm tiết ngay trước nó.',
        solution: 'Nhấn rõ: se-lə-BREY-shən /ˌsel.əˈbreɪ.ʃən/.',
      },
      {
        title: 'Nuốt âm đuôi /s/ trong "traditions" và "wishes"',
        where: 'Từ "traditions" (/trəˈdɪʃ.ənz/) và "wishes" (/ˈwɪʃ.ɪz/)',
        mistake: 'Bỏ âm đuôi /ɪz/ trong "wishes" đọc thành "uýt".',
        why: 'Đuôi "-es" sau âm /ʃ/ bắt buộc phát âm là /ɪz/.',
        solution: 'Đọc rõ 2 âm tiết: /ˈwɪʃ.ɪz/.',
      },
    ],
    vietnameseTips: [
      'Từ vựng phong phú: "family reunion" (đoàn tụ gia đình), "lunar calendar" (âm lịch), "exchanging lucky money" (trao lì xì).',
      'Nêu cảm xúc cá nhân: "It brings a sense of togetherness and optimism for the upcoming year".',
    ],
  },

  // Question 9: Traveling
  'Do you prefer traveling alone or traveling with a group of friends?': {
    grammarMistakes: [
      {
        title: 'Dùng sai cấu trúc sau "prefer ... to ..."',
        where: 'Câu: "I prefer travel alone than travel with friends"',
        mistake: 'Dùng động từ nguyên mẫu và dùng "than" thay vì "to + V-ing".',
        why: 'Cấu trúc chuẩn: PREFER V-ing TO V-ing (không dùng than).',
        solution: 'Sửa thành: "I prefer TRAVELING alone TO GOING with a large group".',
      },
      {
        title: 'Nhầm lẫn giữa "alone" (trạng từ/tính từ) và "lonely" (tính từ cô đơn)',
        where: 'Câu: "I like traveling lonely"',
        mistake: 'Dùng "lonely" (cảm giác cô đơn, buồn bã) thay vì "alone" (một mình, tự lập).',
        why: '"Alone" nghĩa là đi một mình độc lập, còn "lonely" là mang cảm xúc tiêu cực.',
        solution: 'Sửa thành: "I prefer traveling ALONE / SOLITARY TRAVEL" hoặc "solo trips".',
      },
    ],
    pronunciationMistakes: [
      {
        title: 'Phát âm sai âm /v/ trong "traveling" thành /b/',
        where: 'Từ "traveling" (/ˈtræv.əl.ɪŋ/)',
        mistake: 'Nhiều người Việt phát âm "tra-bồ-linh" do răng trên không cắn nhẹ môi dưới.',
        why: 'Phụ âm /v/ là âm môi-răng hữu thanh, răng hàm trên phải chạm nhẹ vào môi dưới.',
        solution: 'Cắn nhẹ môi dưới tạo độ rung: /ˈtræv.əl.ɪŋ/.',
      },
      {
        title: 'Sai trọng âm từ "memorable" và "experience"',
        where: 'Từ "experience" (/ɪkˈspɪə.ri.əns/)',
        mistake: 'Đọc nhấn âm 1 hoặc phát âm thiếu âm /k/ trong "ex-".',
        why: '"Experience" có trọng âm rơi vào âm tiết thứ 2 (-spear-).',
        solution: 'Nhấn âm 2 rõ ràng: ik-SPEER-ee-əns /ɪkˈspɪə.ri.əns/.',
      },
    ],
    vietnameseTips: [
      'So sánh ưu điểm 2 bên: "Traveling alone offers absolute freedom, whereas traveling with friends doubles the joy and creates unforgettable memories".',
      'Dùng từ hay: "spontaneity" (sự tự phát ngẫu hứng), "budget-sharing" (chia sẻ chi phí), "lifelong bonding" (gắn kết bền chặt).',
    ],
  },

  // Question 10: Future Hobbies
  'What new hobby or skill would you like to take up in the future?': {
    grammarMistakes: [
      {
        title: 'Dùng sai thể động từ sau "would like to"',
        where: 'Câu: "I would like taking up" hoặc "I would like to took up"',
        mistake: 'Dùng V-ing hoặc V-quá khứ sau "would like to".',
        why: 'Quy tắc: WOULD LIKE TO + Động từ nguyên mẫu (Bare Infinitive).',
        solution: 'Sửa thành: "I would like TO TAKE UP digital illustration in the future".',
      },
      {
        title: 'Dùng sai cụm động từ (Phrasal Verb) "take up"',
        where: 'Cụm từ: "take on / take off a hobby"',
        mistake: 'Nhầm lẫn giữa "take up" (bắt đầu một sở thích mới) với các phrasal verb khác.',
        why: '"Take up" là cụm từ chuẩn mực chỉ việc bắt đầu dành thời gian cho một môn nghệ thuật hoặc sở thích mới.',
        solution: 'Sửa thành: "I am eager to TAKE UP playing the piano / coding".',
      },
    ],
    pronunciationMistakes: [
      {
        title: 'Phát âm sai từ "future" (/ˈfjuː.tʃər/) thành "phu-tu-re"',
        where: 'Từ "future"',
        mistake: 'Đọc theo mặt chữ không có âm bật /tʃ/ và âm /ju:/.',
        why: 'Âm "tu" trong "future" phát âm là /tʃər/ (giống âm ch trong tiếng Việt nhưng bật mạnh hơn).',
        solution: 'Đọc chuẩn: /ˈfjuː.tʃər/ (phiu-chờ).',
      },
      {
        title: 'Nuốt phụ âm tổ hợp /sk/ trong "skill" và /pl/ trong "explore"',
        where: 'Từ "skill" (/skɪl/)',
        mistake: 'Bỏ âm /s/ chỉ đọc thành "kiu" hoặc đọc rời rạc "sơ-kiu".',
        why: 'Cần lướt từ âm /s/ gió sang âm /k/ liền mạch: /skɪl/.',
        solution: 'Đọc dứt khoát: /skɪl/.',
      },
    ],
    vietnameseTips: [
      'Nêu rõ lí do học: "It allows me to unleash my creative potential" hoặc "It enhances my career prospects".',
      'Đưa ra lộ trình ngắn gọn: "I plan to enroll in an online course next summer".',
    ],
  },
};

// Generic fallback if a prompt is outside the predefined pool
export const DEFAULT_VIETNAMESE_SPEAKING_ANALYSIS: VietnameseSpeakingAnalysis = {
  grammarMistakes: [
    {
      title: 'Chia sai thì động từ & thiếu đuôi "-s/-es"',
      where: 'Các động từ ở ngôi thứ 3 số ít (He, She, It) hoặc danh từ số nhiều',
      mistake: 'Quên thêm đuôi "-s/-es" khi miêu tả thói quen hoặc sự thật ở thì Hiện tại đơn.',
      why: 'Người Việt không có thói quen biến đổi hình thái từ theo ngôi và thì, dẫn đến việc quên chia động từ.',
      solution: 'Luôn chú ý chủ ngữ số ít để thêm -s/-es: "It helps me", "She prefers", "My friend enjoys".',
    },
    {
      title: 'Lỗi cấu trúc câu ghép & dùng sai liên từ',
      where: 'Nối các vế câu dài ("Although... but...", "Because... so...")',
      mistake: 'Dùng cả 2 liên từ trong một câu (do thói quen dịch "Mặc dù... nhưng...", "Bởi vì... cho nên...").',
      why: 'Trong tiếng Anh chỉ được dùng 1 liên từ duy nhất cho 2 mệnh đề: Dùng Although thì bỏ But, dùng Because thì bỏ So.',
      solution: 'Sửa thành: "Although it is difficult, I still enjoy it" (không thêm "but").',
    },
  ],
  pronunciationMistakes: [
    {
      title: 'Bỏ quên phụ âm đuôi (Ending Sounds /s/, /z/, /t/, /d/, /ks/)',
      where: 'Các từ kết thúc bằng phụ âm gió hoặc âm bật hơi',
      mistake: 'Nuốt âm cuối khiến người nghe không nhận biết được thì của câu hoặc dạng số ít/số nhiều.',
      why: 'Hệ thống ngữ âm tiếng Việt là âm tiết đóng hoặc mở tự nhiên, không có cụm phụ âm bật hơi cuối từ.',
      solution: 'Dành 0.2 giây bật nhẹ âm đuôi: /s/, /t/, /d/. Đây là tiêu chí giúp tăng band điểm Pronunciation nhanh nhất!',
    },
    {
      title: 'Không nhấn trọng âm từ (Word Stress)',
      where: 'Các từ có từ 2 âm tiết trở lên (preference, activity, important...)',
      mistake: 'Nói bằng bằng ngang giọng như tiếng Việt không dấu, không có âm cao âm thấp.',
      why: 'Tiếng Anh là ngôn ngữ có trọng âm (Stress-timed language), từ không nhấn trọng âm sẽ khiến giám khảo khó bắt từ.',
      solution: 'Đọc âm có trọng âm cao hơn, dài hơn và to hơn; các âm còn lại lướt nhanh và trầm hơn.',
    },
  ],
  vietnameseTips: [
    'Tập thói quen nói trọn vẹn câu: Subject + Verb + Object + Reason / Example.',
    'Tránh ngập ngừng lâu bằng cách dùng filler words tự nhiên: "Well, to be honest...", "As far as I am concerned...".',
  ],
};

export function getVietnameseAnalysisForQuestion(questionText: string, userTranscript?: string): VietnameseSpeakingAnalysis {
  const matchedKey = Object.keys(VIETNAMESE_SPEAKING_ANALYSIS_MAP).find(
    k => questionText.toLowerCase().includes(k.toLowerCase().slice(0, 25))
  );

  const baseAnalysis = matchedKey ? VIETNAMESE_SPEAKING_ANALYSIS_MAP[matchedKey] : DEFAULT_VIETNAMESE_SPEAKING_ANALYSIS;

  // If user provided a real transcript, we can detect if they had specific patterns
  if (userTranscript && userTranscript.trim().length > 0) {
    const text = userTranscript.toLowerCase();
    const dynamicGrammar: typeof baseAnalysis.grammarMistakes = [...baseAnalysis.grammarMistakes];
    const dynamicPronunciation: typeof baseAnalysis.pronunciationMistakes = [...baseAnalysis.pronunciationMistakes];

    // Check for "like + V_bare"
    if (/\blike (read|study|listen|cook|travel|play|swim)\b/.test(text)) {
      dynamicGrammar.unshift({
        title: 'Lỗi phát hiện trong câu của bạn: Dùng động từ nguyên mẫu sau "like"',
        where: `Bạn nói: "${text.match(/\blike (read|study|listen|cook|travel|play|swim)\b/)?.[0]}"`,
        mistake: 'Dùng động từ nguyên mẫu không "to" sau like.',
        why: 'Động từ chỉ sở thích "like / enjoy / prefer" phải đi cùng danh động từ V-ing hoặc To-V.',
        solution: 'Hãy sửa lại thành "like reading" hoặc "like studying".',
      });
    }

    // Check for missing "to" after listen
    if (/\blisten (music|acoustic|pop|rock)\b/.test(text)) {
      dynamicGrammar.unshift({
        title: 'Lỗi phát hiện trong câu của bạn: Thiếu giới từ "to" sau "listen"',
        where: `Bạn nói: "${text.match(/\blisten (music|acoustic|pop|rock)\b/)?.[0]}"`,
        mistake: 'Nói trực tiếp "listen music" mà không có giới từ "to".',
        why: '"Listen" luôn cần giới từ "to" khi có tân ngữ chỉ bài hát/âm thanh theo sau.',
        solution: 'Sửa thành: "listen TO music".',
      });
    }

    return {
      grammarMistakes: dynamicGrammar.slice(0, 3),
      pronunciationMistakes: dynamicPronunciation.slice(0, 3),
      vietnameseTips: baseAnalysis.vietnameseTips,
    };
  }

  return baseAnalysis;
}
