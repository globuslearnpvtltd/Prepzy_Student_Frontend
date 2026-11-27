// The diagnostic report's scales: each band, pace and thinking style with what it means for the student.
// Shared by the board report and the competitive "How You Learn" tab.

export const SCALES = {
  band: [
    {
      key: 'below_basic',
      label: 'Below Basic',
      meaning:
        'The basics in these chapters are still being built. Starting from the concept rather than the practice is what will move this fastest.',
    },
    {
      key: 'basic',
      label: 'Basic',
      meaning:
        'You have the core ideas, but they are not yet steady enough to rely on under time pressure. Regular practice on the same chapters will firm them up.',
    },
    {
      key: 'proficient',
      label: 'Proficient',
      meaning:
        'You handle most of this comfortably. The gains now come from the specific gaps rather than from covering everything again.',
    },
    {
      key: 'advanced',
      label: 'Advanced',
      meaning:
        'You are on top of these chapters. Harder questions and full-length timed sets are the useful next step.',
    },
  ],
  pace: [
    {
      key: 'rushing',
      label: 'Rushing',
      meaning:
        'You finished well ahead of the time the paper allows. That spare time is worth spending on a second read of the questions you were unsure about.',
    },
    {
      key: 'normal',
      label: 'Normal',
      meaning: 'You used your time well — neither rushing nor running short. Keep that rhythm in the real paper.',
    },
    {
      key: 'careful',
      label: 'Careful',
      meaning:
        'You spent longer on each question than the paper allows. Timed practice will help you reach the end without leaving questions behind.',
    },
  ],
  thinking: [
    {
      key: 'conceptual',
      label: 'Conceptual',
      meaning:
        'You did best on questions that test whether you understand the idea, rather than ones that ask you to compute. Your plan leads with the explanation before the drill.',
    },
    {
      key: 'numerical',
      label: 'Numerical',
      meaning:
        'You did best where there was a clear method to follow step by step. Your plan leans on worked examples so the method is visible before you practise it.',
    },
    {
      key: 'case_based',
      label: 'Case Based',
      meaning:
        'You did best when an idea was set in a real situation and you had to work out what applied. Your plan uses applied questions to build on that.',
    },
    {
      key: 'balanced',
      label: 'No clear style',
      meaning:
        'No single question type stood out — your accuracy was close across them. That is a fine place to be; your plan keeps a balance rather than favouring one kind.',
    },
  ],
};
