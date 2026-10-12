import { QuizQuestion, QuizQuestionMode } from '../types';
import { EXTENDED_SPEAKING_BANK, SpeakingQuestionItem } from './speakingBank';

export { EXTENDED_SPEAKING_BANK };

export interface IeltsSpeakingChallenge {
  id: string;
  question: string;
  sampleAnswer: string;
  keywords: string[];
  topic: string;
  suggestedIdiom: string;
}

export const IELTS_SPEAKING_POOL: IeltsSpeakingChallenge[] = [
  {
    id: 'ielts_1',
    question: 'Do you like reading books?',
    sampleAnswer: 'Yes, I really enjoy reading books. It is a wonderful way to relax, broaden my horizons, and acquire useful knowledge in my daily life.',
    keywords: ['reading books', 'broaden my horizons', 'relax', 'acquire knowledge', 'daily life'],
    topic: 'Reading & Hobbies (Part 1)',
    suggestedIdiom: 'broaden my horizons',
  },
  {
    id: 'ielts_2',
    question: 'Do you prefer studying in the morning or at night? Why?',
    sampleAnswer: 'I definitely prefer studying early in the morning when my mind is completely refreshed and free from daily distractions.',
    keywords: ['early in the morning', 'refreshed', 'distractions', 'productivity', 'focus'],
    topic: 'Daily Routine & Study (Part 1)',
    suggestedIdiom: 'early bird',
  },
  {
    id: 'ielts_3',
    question: 'What kind of music do you usually listen to when you want to relax?',
    sampleAnswer: 'I usually tune into ambient acoustic melodies or classical music to unwind and relieve stress after a demanding day.',
    keywords: ['ambient', 'acoustic', 'unwind', 'relieve stress', 'melodies'],
    topic: 'Music & Leisure (Part 1)',
    suggestedIdiom: 'music to my ears',
  },
  {
    id: 'ielts_4',
    question: 'Describe your hometown. What is the most memorable aspect of it?',
    sampleAnswer: 'My hometown is a vibrant coastal city with stunning sandy beaches, hospitable residents, and delectable fresh seafood.',
    keywords: ['hometown', 'vibrant', 'coastal', 'hospitable', 'delectable'],
    topic: 'Hometown & Geography (Part 1)',
    suggestedIdiom: 'home is where the heart is',
  },
  {
    id: 'ielts_5',
    question: 'Do you enjoy spending your free time outdoors in nature or indoors?',
    sampleAnswer: 'I lean towards outdoor activities such as hiking and jogging because breathing fresh air revitalizes my physical energy.',
    keywords: ['outdoors', 'nature', 'hiking', 'revitalizes', 'fresh air'],
    topic: 'Nature & Lifestyle (Part 1)',
    suggestedIdiom: 'a breath of fresh air',
  },
  {
    id: 'ielts_6',
    question: 'How often do you use social media, and what do you primarily use it for?',
    sampleAnswer: 'I browse social media platforms daily to keep in touch with close acquaintances and follow educational tech blogs.',
    keywords: ['social media', 'keep in touch', 'acquaintances', 'educational', 'connectivity'],
    topic: 'Technology & Communication (Part 1)',
    suggestedIdiom: 'keep in the loop',
  },
  {
    id: 'ielts_7',
    question: 'Do you enjoy cooking meals for your friends and family?',
    sampleAnswer: 'Cooking is one of my therapeutic hobbies. I take great pride in whipping up traditional home-cooked delicacies for my loved ones.',
    keywords: ['therapeutic', 'whipping up', 'delicacies', 'home-cooked', 'pride'],
    topic: 'Food & Cooking (Part 1)',
    suggestedIdiom: 'whip up a storm',
  },
  {
    id: 'ielts_8',
    question: 'What is your favorite festival or celebration in your country?',
    sampleAnswer: 'My absolute favorite is the Lunar New Year celebration because it gathers extended families together in harmony and joy.',
    keywords: ['favorite festival', 'celebration', 'harmony', 'reunion', 'festivity'],
    topic: 'Culture & Festivals (Part 1)',
    suggestedIdiom: 'once in a blue moon',
  },
  {
    id: 'ielts_9',
    question: 'Do you prefer traveling alone or traveling with a group of friends?',
    sampleAnswer: 'I prefer traveling with close friends because sharing breathtaking scenery and laughter makes the expedition far more memorable.',
    keywords: ['traveling', 'companions', 'breathtaking', 'expedition', 'memorable'],
    topic: 'Travel & Tourism (Part 1)',
    suggestedIdiom: 'travel broadens the mind',
  },
  {
    id: 'ielts_10',
    question: 'What new hobby or skill would you like to take up in the future?',
    sampleAnswer: 'I would love to learn digital illustration and animation so that I can bring creative fantasy worlds to life.',
    keywords: ['digital illustration', 'animation', 'creative', 'skill', 'fantasy'],
    topic: 'Future Aspirations (Part 1)',
    suggestedIdiom: 'spread my wings',
  },
];

export const MCQ_POOL_Q1: QuizQuestion[] = [
  {
    id: 'mcq_1',
    type: 'mcq',
    title: 'VOCABULARY CHALLENGE: QUESTION 1',
    category: 'Vocabulary',
    sentence: 'The ancient forest felt magical and enchanted.',
    question: 'What does the word "Enchanted" mean in this sentence?',
    options: ['Dull and Boring', 'Scary and Dark', 'Filled with Magic', 'Very Large'],
    correctIndex: 2,
    assignedStarmonIndex: 0,
  },
  {
    id: 'mcq_2',
    type: 'mcq',
    title: 'VOCABULARY CHALLENGE: QUESTION 1',
    category: 'Vocabulary',
    sentence: 'The resilient guardian defended the sanctuary against all invaders.',
    question: 'Which word is the closest synonym for "Resilient"?',
    options: ['Fragile', 'Durable and Strong', 'Aggressive', 'Confused'],
    correctIndex: 1,
    assignedStarmonIndex: 0,
  },
  {
    id: 'mcq_3',
    type: 'mcq',
    title: 'VOCABULARY CHALLENGE: QUESTION 1',
    category: 'Vocabulary',
    sentence: 'The dragon manifested an immense barrier of crystalline ice.',
    question: 'What does "Immense" mean in this context?',
    options: ['Tiny and Weak', 'Extremely Large', 'Melting Fast', 'Incomplete'],
    correctIndex: 1,
    assignedStarmonIndex: 0,
  },
  {
    id: 'mcq_4',
    type: 'mcq',
    title: 'VOCABULARY CHALLENGE: QUESTION 1',
    category: 'Vocabulary',
    sentence: 'The lightning lynx struck with extraordinary velocity.',
    question: 'What does the word "Velocity" refer to?',
    options: ['Speed and Swiftness', 'Weight and Bulk', 'Loud Noise', 'Color Brightness'],
    correctIndex: 0,
    assignedStarmonIndex: 0,
  },
];

export const MCQ_POOL_Q2: QuizQuestion[] = [
  {
    id: 'mcq_q2_1',
    type: 'mcq',
    title: 'GRAMMAR MASTERY: QUESTION 2',
    category: 'Grammar',
    sentence: 'If the dragon ______ the fire rune, the celestial barrier will break.',
    question: 'Choose the correct verb form to complete the First Conditional sentence:',
    options: ['activates', 'will activate', 'activated', 'had activated'],
    correctIndex: 0,
    assignedStarmonIndex: 1,
  },
  {
    id: 'mcq_q2_2',
    type: 'mcq',
    title: 'GRAMMAR MASTERY: QUESTION 2',
    category: 'Grammar',
    sentence: 'By the time the sun rises, the guardians ______ across the ocean.',
    question: 'Choose the correct Future Perfect tense:',
    options: ['will fly', 'will have flown', 'flew', 'are flying'],
    correctIndex: 1,
    assignedStarmonIndex: 1,
  },
  {
    id: 'mcq_q2_3',
    type: 'mcq',
    title: 'GRAMMAR MASTERY: QUESTION 2',
    category: 'Grammar',
    sentence: 'Neither the warriors nor the archer ______ ready for the dragon raid.',
    question: 'Choose the correct subject-verb agreement:',
    options: ['were', 'was', 'are', 'have been'],
    correctIndex: 1,
    assignedStarmonIndex: 1,
  },
  {
    id: 'mcq_q2_4',
    type: 'mcq',
    title: 'GRAMMAR MASTERY: QUESTION 2',
    category: 'Grammar',
    sentence: 'The potion was ______ potent that it restored the guardian instantly.',
    question: 'Choose the correct correlative conjunction:',
    options: ['too', 'such', 'so', 'very'],
    correctIndex: 2,
    assignedStarmonIndex: 1,
  },
];

export const MCQ_POOL_Q3: QuizQuestion[] = [
  {
    id: 'mcq_q3_1',
    type: 'mcq',
    title: 'COLOCATIONS & IDIOMS: QUESTION 3',
    category: 'Vocabulary',
    sentence: 'The academy made a ______ breakthrough in understanding cosmic elemental fusion.',
    question: 'Which adjective collocates best with "breakthrough"?',
    options: ['minor', 'major', 'heavy', 'harsh'],
    correctIndex: 1,
    assignedStarmonIndex: 2,
  },
  {
    id: 'mcq_q3_2',
    type: 'mcq',
    title: 'PREPOSITIONS & USAGE: QUESTION 3',
    category: 'Grammar',
    sentence: 'The ancient guardian is highly capable ______ channeling arcane energy.',
    question: 'Choose the correct preposition to complete the phrase "capable _____":',
    options: ['for', 'with', 'of', 'in'],
    correctIndex: 2,
    assignedStarmonIndex: 2,
  },
  {
    id: 'mcq_q3_3',
    type: 'mcq',
    title: 'CONNECTORS & COHESION: QUESTION 3',
    category: 'Grammar',
    sentence: 'The beast was formidable; ______, our tactical unity secured a decisive victory.',
    question: 'Choose the best transitional adverb to express contrast:',
    options: ['furthermore', 'nevertheless', 'consequently', 'similarly'],
    correctIndex: 1,
    assignedStarmonIndex: 2,
  },
  {
    id: 'mcq_q3_4',
    type: 'mcq',
    title: 'IDIOMATIC EXPRESSIONS: QUESTION 3',
    category: 'Vocabulary',
    sentence: 'After extensive strategic debate, the team finally saw eye to eye.',
    question: 'What does the idiom "see eye to eye" mean?',
    options: ['Stared in anger', 'Agreed completely', 'Ignored each other', 'Became rivals'],
    correctIndex: 1,
    assignedStarmonIndex: 2,
  },
  {
    id: 'mcq_q3_5',
    type: 'mcq',
    title: 'ADVANCED VOCABULARY: QUESTION 3',
    category: 'Vocabulary',
    sentence: 'The mystic aura dissipated gradually into the midnight air.',
    question: 'What is the closest synonym for "dissipated"?',
    options: ['vanished and scattered', 'intensified quickly', 'crystallized', 'multiplied'],
    correctIndex: 0,
    assignedStarmonIndex: 2,
  },
];

export function createSpeakingQuizQuestion(
  item: SpeakingQuestionItem,
  slotIndex: number,
  questionNumber: number
): QuizQuestion {
  return {
    id: `speaking_${item.id}_${Date.now()}_${slotIndex}`,
    type: 'speaking',
    title: `IELTS SPEAKING PART 1: CÂU HỎI ${questionNumber} (${item.topic})`,
    category: 'IELTS Speaking',
    question: item.question,
    speakingPrompt: item.sampleAnswer,
    minBand: 5.5,
    assignedStarmonIndex: slotIndex,
  };
}

export function getRandomQuizSet(
  activeStarmonCount: number = 3,
  mode: QuizQuestionMode = 'speaking_only'
): QuizQuestion[] {
  // Dynamically generate questions corresponding strictly to the number of Starmons in the Party (1, 2, or 3)
  const count = Math.max(1, Math.min(3, activeStarmonCount));

  // 1. CHẾ ĐỘ ONLY SPEAKING (DEFAULT: Số câu hỏi speaking bằng đúng số lượng Starmon trong Party)
  if (mode === 'speaking_only') {
    const shuffled = [...EXTENDED_SPEAKING_BANK].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count).map((item, idx) =>
      createSpeakingQuizQuestion(item, idx, idx + 1)
    );
  }

  // 2. CHẾ ĐỘ ONLY MCQ (Số câu trắc nghiệm bằng đúng số lượng Starmon trong Party)
  if (mode === 'mcq_only') {
    const pools = [MCQ_POOL_Q1, MCQ_POOL_Q2, MCQ_POOL_Q3];
    const titles = ['TỪ VỰNG: CÂU HỎI 1', 'NGỮ PHÁP: CÂU HỎI 2', 'KẾT HỢP TỪ & THÀNH NGỮ: CÂU HỎI 3'];
    return Array.from({ length: count }, (_, idx) => {
      const pool = pools[idx % pools.length];
      const q = { ...pool[Math.floor(Math.random() * pool.length)], assignedStarmonIndex: idx };
      return {
        ...q,
        id: `${q.id}_${Date.now()}_${idx}`,
        title: titles[idx] || `CÂU HỎI ${idx + 1}`,
      };
    });
  }

  // 3. CHẾ ĐỘ MCQ + SPEAKING (HỖN HỢP)
  if (count === 1) {
    const randomSpeaking = EXTENDED_SPEAKING_BANK[Math.floor(Math.random() * EXTENDED_SPEAKING_BANK.length)] || IELTS_SPEAKING_POOL[0];
    return [createSpeakingQuizQuestion(randomSpeaking, 0, 1)];
  } else if (count === 2) {
    const q1 = { ...MCQ_POOL_Q1[Math.floor(Math.random() * MCQ_POOL_Q1.length)], assignedStarmonIndex: 0 };
    const randomSpeaking = EXTENDED_SPEAKING_BANK[Math.floor(Math.random() * EXTENDED_SPEAKING_BANK.length)] || IELTS_SPEAKING_POOL[0];
    const q2 = createSpeakingQuizQuestion(randomSpeaking, 1, 2);
    return [
      { ...q1, id: `${q1.id}_${Date.now()}_0`, title: `TỪ VỰNG: CÂU HỎI 1` },
      q2,
    ];
  } else {
    const q1 = { ...MCQ_POOL_Q1[Math.floor(Math.random() * MCQ_POOL_Q1.length)], assignedStarmonIndex: 0 };
    const q2 = { ...MCQ_POOL_Q2[Math.floor(Math.random() * MCQ_POOL_Q2.length)], assignedStarmonIndex: 1 };
    const randomSpeaking = EXTENDED_SPEAKING_BANK[Math.floor(Math.random() * EXTENDED_SPEAKING_BANK.length)] || IELTS_SPEAKING_POOL[0];
    const q3 = createSpeakingQuizQuestion(randomSpeaking, 2, 3);
    return [
      { ...q1, id: `${q1.id}_${Date.now()}_0`, title: `TỪ VỰNG: CÂU HỎI 1` },
      { ...q2, id: `${q2.id}_${Date.now()}_1`, title: `NGỮ PHÁP: CÂU HỎI 2` },
      q3,
    ];
  }
}
