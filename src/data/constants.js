// ============================================================
// Courtly – Game Constants
// ============================================================

export const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

export const PLAYER_PERSONALITIES = [
  'Kind',
  'Reckless',
  'Volatile',
  'Easy to Get Mad',
  'Calm',
  'Leader',
  'Selfish',
  'Team Player',
  'Aggressive',
  'Patient',
  'Disciplined',
  'Charismatic',
  'Introverted',
  'Competitive',
  'Lazy',
  'Hard Worker',
  'Emotional',
  'Stoic',
  'Friendly',
  'Arrogant',
  'Humble',
  'Resilient',
  'Hot-Headed',
  'Focused',
  'Mercurial',
];

export const NATIONALITIES = [
  'American',
  'Canadian',
  'Brazilian',
  'Argentinian',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Greek',
  'Turkish',
  'Serbian',
  'Croatian',
  'Slovenian',
  'Lithuanian',
  'Latvian',
  'Australian',
  'Nigerian',
  'Senegalese',
  'Cameroonian',
  'Congolese',
  'Angolan',
  'South African',
  'Chinese',
  'Japanese',
  'South Korean',
  'Filipino',
  'Lebanese',
  'Israeli',
  'Iranian',
  'Sudanese',
  'British',
  'Dutch',
  'Polish',
  'Czech',
  'Montenegrin',
  'Venezuelan',
  'Dominican',
  'Puerto Rican',
  'New Zealander',
  'Icelandic',
];

export const STAFF_ROLES = [
  'Head Coach',
  'Assistant Coach',
  'Physio',
  'Scout',
  'Psychologist',
  'Nutritionist',
  'Strength & Conditioning Coach',
  'Data Analyst',
  'Team Manager',
];

export const STAFF_CHARACTERIZATIONS = [
  'Tactical Mastermind',
  'Player Developer',
  'Motivator',
  'Defensive Specialist',
  'Offensive Innovator',
  'Youth Advocate',
  'Experienced Veteran',
  'Data-Driven',
  'Old School',
  'Relationship Builder',
  'Strict Disciplinarian',
  'Laid-Back',
  'High Intensity',
  'Detail Oriented',
  'Big Picture Thinker',
];

export const ATTRIBUTE_NAMES = {
  courtVision: {
    label: 'Court Vision',
    description: 'Ability to read the game and anticipate plays',
  },
  perimeterDefense: {
    label: 'Perimeter Defense',
    description: 'Effectiveness defending outside shooters',
  },
  interiorDefense: {
    label: 'Interior Defense',
    description: 'Effectiveness defending in the paint',
  },
  offBallMovement: {
    label: 'Off-Ball Movement',
    description: 'Ability to create space and openings without the ball',
  },
  rebounding: {
    label: 'Rebounding',
    description: 'Ability to secure missed shots',
  },
  freeThrowShooting: {
    label: 'Free Throw Shooting',
    description: 'Accuracy at the free-throw line',
  },
  clutchPerformance: {
    label: 'Clutch Performance',
    description: 'Performance in high-pressure moments',
  },
  staminaEndurance: {
    label: 'Stamina/Endurance',
    description: 'Ability to maintain performance over long periods',
  },
  leadershipCommunication: {
    label: 'Leadership/Communication',
    description: 'Ability to lead and communicate on the court',
  },
  postMoves: {
    label: 'Post Moves',
    description: 'Skill in scoring from the post position',
  },
  threePtShooting: {
    label: '3-Point Shooting',
    description: 'Accuracy shooting from beyond the arc',
  },
  midRangeScoring: {
    label: 'Mid-Range Scoring',
    description: 'Accuracy from mid-range distances',
  },
  ballHandlingDribbling: {
    label: 'Ball Handling/Dribbling',
    description: 'Control of the ball while dribbling',
  },
  passingAccuracy: {
    label: 'Passing Accuracy',
    description: 'Accuracy and timing of passes',
  },
  basketballIQ: {
    label: 'Basketball IQ',
    description: 'Overall understanding of the game',
  },
  aggressivenessOffensive: {
    label: 'Aggressiveness (Offensive)',
    description: 'Willingness to attack the basket and draw fouls',
  },
  helpDefense: {
    label: 'Help Defense',
    description: 'Ability to provide defensive support to teammates',
  },
  onBallScreenNavigation: {
    label: 'On-Ball Screen Navigation',
    description: 'Ability to use and navigate through screens',
  },
  conditioningFitness: {
    label: 'Conditioning/Fitness',
    description: 'Overall physical fitness level',
  },
  patienceOffense: {
    label: 'Patience (Offense)',
    description: 'Ability to wait for the right opportunity on offense',
  },
  disciplineFouling: {
    label: 'Discipline (Fouling)',
    description: 'Tendency to avoid unnecessary fouls',
  },
  handlePressureMental: {
    label: 'Handle Pressure (Mental)',
    description: 'Mental toughness under pressure',
  },
  verticalLeapingAbility: {
    label: 'Vertical/Leaping Ability',
    description: 'Explosive jumping ability',
  },
  agilityLateralSpeed: {
    label: 'Agility/Lateral Speed',
    description: 'Quickness and agility moving side-to-side',
  },
  settingScreens: {
    label: 'Setting Screens',
    description: 'Effectiveness setting picks for teammates',
  },
  finishingAtTheRim: {
    label: 'Finishing at the Rim',
    description: 'Ability to convert near the basket',
  },
  consistencyPerformance: {
    label: 'Consistency (Performance)',
    description: 'How reliable the player performs game to game',
  },
  workEthicOutOfGame: {
    label: 'Work Ethic (Out of Game)',
    description: 'Dedication to practice and self-improvement',
  },
  teamFirstAttitude: {
    label: 'Team-First Attitude',
    description: 'Willingness to sacrifice individual stats for team success',
  },
  bodyControl: {
    label: 'Body Control',
    description: 'Coordination and balance during athletic movements',
  },
};

export const LEAGUE_NAMES = {
  A: 'Liga A',
  B: 'Liga B',
  C: 'Liga C',
};

export const GAME_INTERVAL_DAYS = 3;

export const SEASON_MATCHES = 18;

export const MATCH_DURATION_MINUTES = 40;

export const STARTING_BALANCE = 200;

export const MAX_ROSTER_SIZE = 12;

export const FACILITY_NAMES = [
  'Training Gym',
  'Medical Center',
  'Scouting Department',
  'Youth Academy',
  'Fan Experience Zone',
  'Analytics Lab',
];

export const FACILITY_BASE_COST = 100;

export const FACILITY_BASE_TIME_HOURS = 10;

export const AVATAR_TYPES = {
  animals: [
    'bear',
    'wolf',
    'eagle',
    'tiger',
    'lion',
    'shark',
    'hawk',
    'panther',
    'fox',
    'bull',
  ],
  monuments: [
    'pyramid',
    'colosseum',
    'tower',
    'statue',
    'arch',
    'castle',
    'lighthouse',
    'obelisk',
    'temple',
    'bridge',
  ],
};

export const TRAINING_AREAS = [
  'Offensive Schemes',
  'Defensive Drills',
  'Skill Work (Shooting)',
  'Conditioning',
  'Team Building',
];
