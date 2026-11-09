/** Doubt solver (Socrates) and Atlas chat sample responses for visual comparison (spread into MOCKS in mocks.ts). */
const COVER = 'http://localhost:3002/assets/img/placeholder/course-image.jpg';
const AVATAR = 'http://localhost:3002/assets/img/chatbot/Atlas.png';

const textbook = (id: number, name: string, className = 'CLASS 12') => ({
  id,
  class_id: 12,
  class_name: className,
  textbook_name: name,
  textbook_image: COVER,
  description: '',
});

const history = {
  success: true,
  data: {
    chats: [
      { chat_id: 501, title: 'Find the derivative of x² sin x', last_message_at: '2026-11-06T09:12:44.000Z', subject_id: 3, subject_name: 'MATHEMATICS', first_message: 'Find the derivative of $x^2 \\sin x$', first_image: null },
      { chat_id: 500, title: 'Why is the sky blue?', last_message_at: '2026-11-04T09:12:44.000Z', subject_id: 1, subject_name: 'PHYSICS', first_message: 'Why is the sky blue?', first_image: null },
    ],
  },
};

const conversations = {
  success: true,
  data: {
    latest_chat: 77,
    previous_chat: 76,
    conversations: [
      { message_id: 1, chat_id: 77, text: 'What is Newton’s second law?', is_student: true, created_at: '2026-11-06T09:10:00.000Z' },
      {
        message_id: 2,
        chat_id: 77,
        text: '<p>Newton’s second law says the net force on a body equals its mass times its acceleration: $F = ma$.</p>',
        is_student: false,
        created_at: '2026-11-06T09:10:05.000Z',
      },
    ],
  },
};

const avatar = { success: true, data: { avatar: [{ id: 1, name: 'Atlas', image: AVATAR }] } };

export const ASSISTANT_MOCKS: Record<string, unknown> = {
  '/api/v2/get-textbooks': {
    success: true,
    subject_courses: [
      { subject_id: 1, subject_name: 'PHYSICS', textbooks: [textbook(11, 'Physics Part 1'), textbook(12, 'Physics Part 2')] },
      { subject_id: 2, subject_name: 'CHEMISTRY', textbooks: [textbook(21, 'Chemistry Part 1')] },
      { subject_id: 3, subject_name: 'MATHEMATICS', textbooks: [textbook(31, 'Mathematics Part 1'), textbook(32, 'Mathematics Part 2')] },
    ],
  },
  '/api/neet/doubt-solver-subjects': {
    success: true,
    subject_courses: [
      { subject_id: 7, subject_name: 'NEET-PHYSICS', textbooks: [textbook(71, 'Physics Class 11', 'NEET')] },
      { subject_id: 8, subject_name: 'NEET-CHEMISTRY', textbooks: [textbook(81, 'Chemistry Class 11', 'NEET')] },
      { subject_id: 9, subject_name: 'NEET-BIOLOGY', textbooks: [textbook(91, 'Biology Class 11', 'NEET'), textbook(92, 'Biology Class 12', 'NEET')] },
    ],
  },
  '/api/chat/step_solver_chat/history': history,
  '/api/v1/chat/dashboard-conversations': conversations,
  '/api/neet/chat/dashboard-conversations': conversations,
  '/api/v1/chat/dashboard-chat-history': { success: true, data: { chats: history.data.chats.map(({ chat_id, title, last_message_at }) => ({ chat_id, title, last_message_at })) } },
  '/api/neet/chat/dashboard-chat-history': { success: true, data: { chats: [] } },
  '/api/v1/chat/marketingChatImageName': avatar,
  '/api/neet/chat/marketingChatImageName': avatar,
  '/api/chat/check-valid-subject-query': { result: 'true' },
  '/api/chat/check_valid_maths_query': { result: 'true' },
  '/api/chat/step_solver_chat/create': { chat_id: 900 },
  '/api/chat/step_solver_chat_interaction/v2': {
    chat_id: 900,
    is_first_query: true,
    current_card_no: 1,
    llm_responses: '<p>Let’s start with the first concept. What happens to the acceleration of a body if the net force on it doubles?</p>',
  },
  '/api/chat/step_solver_concept_card/v1': {
    concept_cards: [
      { card_no: 1, title: 'Newton’s second law', explanation: 'The net force on a body equals mass × acceleration, $F = ma$.' },
      { card_no: 2, title: 'Free body diagram', explanation: 'Draw every force acting on the body.' },
      { card_no: 3, title: 'Solving for acceleration', explanation: 'Rearrange to $a = F/m$.' },
    ],
    sources: { Class: 'Class 12', Subject: 'Physics', Book: 'Physics Part 1', Chapter: 'Laws of Motion', Lecture: null },
  },
  '/api/v1/learn/module-outline/11': {
    success: true,
    data: {
      finalList: [
        { category: 'module', id: 401, title: 'Electric Charges and Fields', module_order: 1 },
        { category: 'module', id: 402, title: 'Electrostatic Potential and Capacitance', module_order: 2 },
      ],
    },
  },
  '/api/v1/learn/chapter-unsolved/401': {
    success: true,
    data: {
      questions: [
        { id: 1, type: 'short_answer', marks: 2, question_text: '<p>What is the force between two charges of $1\\,\\mu C$ placed $1\\,m$ apart?</p>', question_image: null, question_image_description: null, question_level: 1 },
        { id: 2, type: 'long_answer', marks: 5, question_text: '<p>State Coulomb’s law and write it in vector form.</p>', question_image: null, question_image_description: null, question_level: 2 },
      ],
    },
  },
  '/api/v1/learn/chapter-pyqs/401': { success: true, data: { questions: [] } },
};
