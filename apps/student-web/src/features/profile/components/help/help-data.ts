// Help and support content (the previous app's helpData). Answers describe how the app works today;
// edit here when that changes. Only "Your requests" comes from the server.

export const SUPPORT_PHONE = '+91 74599 68555';
export const SUPPORT_PHONE_TEL = '+917459968555';
export const SUPPORT_EMAIL = 'contact@prepzy.ai';
export const CALL_HOURS = 'Mon to Sat · 10 AM to 7 PM';

export const TOPICS = ['Plans and payments', 'Tests and results', 'Doubts', 'Downloads'] as const;
export type Topic = (typeof TOPICS)[number];

export interface Faq {
  id: string;
  topic: Topic;
  question: string;
  answer: string[];
  keywords?: string[];
}

export const FAQS: Faq[] = [
  {
    id: 'current-plan',
    topic: 'Plans and payments',
    question: 'How do I check my current plan and when it ends?',
    answer: [
      'Go to Profile → My Plans. You’ll see your active plan (Basic or Topper), the exam and class it covers, and the date it ends.',
    ],
    keywords: ['expiry', 'expire', 'validity', 'valid', 'subscription', 'end', 'date'],
  },
  {
    id: 'topper-trial-end',
    topic: 'Plans and payments',
    question: 'What happens when my free 30 days of Topper end?',
    answer: [
      'Your account moves to the Basic plan, which is free forever. All your progress, scores and downloads stay safe.',
      'You can upgrade to Topper anytime from My Plans.',
    ],
    keywords: ['trial', 'free', 'expire', 'expiry', 'downgrade', 'basic'],
  },
  {
    id: 'basic-vs-topper',
    topic: 'Plans and payments',
    question: 'What’s the difference between Basic and Topper, and what if I reach my daily limit?',
    answer: [
      'Both plans give you unlimited video lectures, summary videos, notes and test analysis. Topper gives you about 10 times more doubts, tests and practice each day than Basic.',
      'If you reach a daily limit, you can wait for it to reset at 5:00 AM IST, or upgrade to Topper to get a higher limit right away.',
    ],
    keywords: ['compare', 'difference', 'limit', 'quota', 'reset', 'features'],
  },
  {
    id: 'plan-options',
    topic: 'Plans and payments',
    question: 'Which plans can I choose from?',
    answer: [
      'Topper Monthly: 30 days of full access from the day you buy.',
      'CBSE Topper Academic Year: valid until 30 April or when the academic year ends.',
      'NEET 2027 / 2028 / 2029: valid until 30 June of your exam year.',
      'NEET + CBSE bundle: full NEET access plus a CBSE dashboard where you can switch between Class 11 PCB and Class 12 PCB.',
      'Full-year plans are priced for the months left, so the price goes down each month. Check My Plans for today’s price.',
    ],
    keywords: ['price', 'pricing', 'cost', 'monthly', 'yearly', 'academic', 'neet', 'cbse', 'bundle'],
  },
  {
    id: 'buy-plan',
    topic: 'Plans and payments',
    question: 'How do I upgrade or buy a plan?',
    answer: [
      'Go to Profile → My Plans → Explore Plans, pick a plan and pay.',
      'If you have Refer & Earn credits, tap Apply credits at checkout to pay for up to 100% of the plan.',
    ],
    keywords: ['buy', 'purchase', 'pay', 'payment', 'upgrade', 'credits', 'refer', 'checkout'],
  },
  {
    id: 'refund',
    topic: 'Plans and payments',
    question: 'Can I get a refund?',
    answer: [
      'Yes. Every paid plan comes with a 15-day money-back guarantee. You can use it once per CBSE class and once for NEET.',
      'To ask for a refund, simply go to your active plan and click Cancel.',
    ],
    keywords: ['cancel', 'cancellation', 'money', 'back', 'return', 'guarantee'],
  },
  {
    id: 'tests-practice',
    topic: 'Tests and results',
    question: 'Where do I find tests and practice?',
    answer: [
      'CBSE: a quiz appears after each lecture. Unit tests, mid-terms, finals, mock exams, past board papers and custom exams on your weak topics are on your dashboard.',
      'NEET: chapter assessments, Daily Practice Problems (DPPs), mock exams and 20+ years of PYQs are on your NEET dashboard.',
    ],
    keywords: ['test', 'quiz', 'mock', 'exam', 'practice', 'pyq', 'dpp', 'papers', 'assessment'],
  },
  {
    id: 'submit-results',
    topic: 'Tests and results',
    question: 'How do I submit answers and see my results?',
    answer: [
      'You can type your answer, upload a photo of your handwritten answer, or record it as audio. Prepzy marks your answer right away and shows a detailed analysis.',
      'In CBSE tests, you can also chat about any question to see how your marks were given. Your scores and learning time over time are on your dashboard.',
    ],
    keywords: ['submit', 'result', 'score', 'marks', 'photo', 'audio', 'analysis', 'report'],
  },
  {
    id: 'doubts',
    topic: 'Doubts',
    question: 'How do I get my doubts solved?',
    answer: [
      'Use Atlas on your dashboard for any chapter or book in your class. Use lecture chat inside the video player to ask about the lesson you’re watching. Use Socrates for step-by-step hints.',
      'In Atlas or Socrates, tap the camera to upload a photo of a textbook question or your handwritten problem.',
    ],
    keywords: ['doubt', 'ask', 'question', 'atlas', 'socrates', 'chat', 'hint', 'camera', 'photo'],
  },
  {
    id: 'study-offline',
    topic: 'Downloads',
    question: 'Can I study offline?',
    answer: [
      'Yes. In the Prepzy app, tap download on any video or notes to save them on your phone. Doubt solving and tests need internet.',
    ],
    keywords: ['offline', 'download', 'app', 'internet', 'save'],
  },
];

export const TOP_QUESTION_IDS = ['current-plan', 'topper-trial-end', 'basic-vs-topper', 'refund'];

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'i',
  'my',
  'me',
  'is',
  'are',
  'to',
  'do',
  'how',
  'can',
  'what',
  'where',
  'why',
  'of',
  'in',
  'on',
  'for',
  'and',
  'or',
  'it',
]);

export const searchTokens = (query: string) =>
  query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));

const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

// A token matches a word that starts with it, so "invoice" also finds "invoices"
const hits = (token: string, list: string[]) => list.some((w) => w.startsWith(token));

// Every search word has to appear in the question, answer or keywords; question hits rank first
export const searchFaqs = (query: string): Faq[] => {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return [];
  return FAQS.map((faq) => {
    const q = words(faq.question);
    const rest = [...words(faq.answer.join(' ')), ...(faq.keywords ?? []).flatMap(words), ...words(faq.topic)];
    let score = 0;
    for (const t of tokens) {
      if (hits(t, q)) score += 3;
      else if (hits(t, rest)) score += 1;
      else return null;
    }
    return { faq, score };
  })
    .filter((r): r is { faq: Faq; score: number } => r !== null)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.faq);
};

export const REPORT_TOPICS = [
  'Payment or plan',
  'Login',
  'Wrong content',
  'App not working',
  'Something else',
] as const;

// CMS statuses: new, in_progress, resolved, rejected
export const STATUS: Record<string, { label: string; badge: string }> = {
  new: { label: 'Open', badge: 'bg-brand-75 text-brand' },
  in_progress: { label: 'In progress', badge: 'bg-account-gold-soft text-account-gold' },
  resolved: { label: 'Resolved', badge: 'bg-success-soft text-account-ok-text' },
  rejected: { label: 'Closed', badge: 'bg-account-closed-soft text-account-closed' },
};
export const statusOf = (status?: string | null) => STATUS[status ?? 'new'] ?? STATUS.new!;

export const requestNumber = (id: number) => `#SR-${id}`;
