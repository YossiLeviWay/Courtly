// ============================================================
// Courtly – Name & Location Data
// ============================================================

export const FIRST_NAMES_MALE = [
  // American / Western
  'James', 'Michael', 'Chris', 'Kevin', 'Marcus',
  'DeShawn', 'Tyrone', 'Andre', 'Malik', 'Darius',
  'Jordan', 'Tyler', 'Brandon', 'Jaylen', 'Isaiah',
  'Trevon', 'Kobe', 'Dwayne', 'LaMarcus', 'Kareem',
  // Spanish / Latin American
  'Carlos', 'Alejandro', 'Diego', 'Miguel', 'Pablo',
  'Javier', 'Rodrigo', 'Federico', 'Mateo', 'Sebastián',
  'Emilio', 'Gustavo', 'Leandro', 'Ramiro', 'Andrés',
  // European
  'Luca', 'Marco', 'Nikola', 'Goran', 'Miroslav',
  'Dmitri', 'Bogdan', 'Stefan', 'Filip', 'Marko',
  'Jan', 'Lukas', 'Erik', 'Lars', 'Henrik',
  'Pierre', 'François', 'Baptiste', 'Théo', 'Hugo',
  'Nikos', 'Alexis', 'Kostas', 'Giorgos', 'Petros',
  // African
  'Kwame', 'Kofi', 'Chukwuemeka', 'Oluwaseun', 'Femi',
  'Amara', 'Seydou', 'Moussa', 'Cheikh', 'Boubacar',
  'Didier', 'Yao', 'Kelechi', 'Obinna', 'Emeka',
  // Middle Eastern / Asian
  'Yousef', 'Khalid', 'Tariq', 'Hassan', 'Rami',
  'Wei', 'Jian', 'Ryo', 'Kenji', 'Takashi',
  'Min-jun', 'Seung', 'Hyun', 'Ji-ho', 'Sung',
  // Australian / Pacific
  'Lachlan', 'Hamish', 'Angus', 'Reuben', 'Tae',
  // Additional diverse names
  'Ivan', 'Boris', 'Aleksandar', 'Vladimir', 'Sergei',
  'Mehmet', 'Emre', 'Burak', 'Can', 'Serkan',
  'Zlatan', 'Dejan', 'Nemanja', 'Miloš', 'Vuk',
  'Giannis', 'Thanasis', 'Vassilis', 'Dimitris', 'Antonis',
  'Rudy', 'Tony', 'Nicolas', 'Boris', 'Evan',
];

export const LAST_NAMES = [
  // American / African-American
  'Johnson', 'Williams', 'Davis', 'Brown', 'Jones',
  'Washington', 'Jackson', 'Thompson', 'Robinson', 'Harris',
  'Walker', 'Coleman', 'Mitchell', 'Parker', 'Carter',
  'Turner', 'Howard', 'Griffin', 'Murray', 'Bailey',
  // Hispanic / Latin
  'Rodriguez', 'Martinez', 'Garcia', 'Hernandez', 'Lopez',
  'Gonzalez', 'Perez', 'Ramirez', 'Torres', 'Flores',
  'Delgado', 'Rios', 'Morales', 'Vargas', 'Ortega',
  // European
  'Mueller', 'Schmidt', 'Fischer', 'Weber', 'Wagner',
  'Rossi', 'Ferrari', 'Conti', 'Russo', 'Ricci',
  'Dupont', 'Leroy', 'Martin', 'Bernard', 'Moreau',
  'Kovač', 'Petrović', 'Nikolić', 'Marković', 'Jovanović',
  'Dragić', 'Goran', 'Horváth', 'Kovács', 'Nagy',
  'Papadopoulos', 'Dimitriou', 'Antonopoulos', 'Stavros', 'Kostas',
  // Eastern European / Slavic
  'Nowak', 'Kowalski', 'Wiśniewski', 'Wójcik', 'Kowalczyk',
  'Ivanov', 'Petrov', 'Sokolov', 'Volkov', 'Fedorov',
  'Popović', 'Lazić', 'Stanković', 'Đorđević', 'Milošević',
  // African
  'Diallo', 'Traoré', 'Koné', 'Bah', 'Sow',
  'Okafor', 'Eze', 'Nwachukwu', 'Adenike', 'Obi',
  'Mensah', 'Asante', 'Boateng', 'Antwi', 'Owusu',
  // Middle Eastern / Asian
  'Al-Hassan', 'Al-Farsi', 'Nakamura', 'Tanaka', 'Watanabe',
  'Kim', 'Lee', 'Park', 'Choi', 'Jung',
  'Sharma', 'Patel', 'Singh', 'Kumar', 'Mehta',
  // Australian / Other
  'O\'Brien', 'Murphy', 'Sullivan', 'Quinn', 'Byrne',
  'Anderson', 'Eriksson', 'Lindqvist', 'Bergström', 'Johansson',
];

export const TEAM_CITY_PAIRS = [
  // Americas
  { city: 'New Cartagena', country: 'Colombia', region: 'Americas' },
  { city: 'Porto Alegre', country: 'Brazil', region: 'Americas' },
  { city: 'Monterrey', country: 'Mexico', region: 'Americas' },
  { city: 'Bogotá', country: 'Colombia', region: 'Americas' },
  { city: 'Lima', country: 'Peru', region: 'Americas' },
  { city: 'Santiago', country: 'Chile', region: 'Americas' },
  { city: 'Buenos Aires', country: 'Argentina', region: 'Americas' },
  { city: 'Medellín', country: 'Colombia', region: 'Americas' },
  { city: 'Caracas', country: 'Venezuela', region: 'Americas' },
  { city: 'Santo Domingo', country: 'Dominican Republic', region: 'Americas' },
  { city: 'Kingston', country: 'Jamaica', region: 'Americas' },
  { city: 'Havana', country: 'Cuba', region: 'Americas' },
  { city: 'Quito', country: 'Ecuador', region: 'Americas' },
  // Europe
  { city: 'Valencia', country: 'Spain', region: 'Europe' },
  { city: 'Lyon', country: 'France', region: 'Europe' },
  { city: 'Turin', country: 'Italy', region: 'Europe' },
  { city: 'Thessaloniki', country: 'Greece', region: 'Europe' },
  { city: 'Novi Sad', country: 'Serbia', region: 'Europe' },
  { city: 'Split', country: 'Croatia', region: 'Europe' },
  { city: 'Kaunas', country: 'Lithuania', region: 'Europe' },
  { city: 'Riga', country: 'Latvia', region: 'Europe' },
  { city: 'Ankara', country: 'Turkey', region: 'Europe' },
  { city: 'Izmir', country: 'Turkey', region: 'Europe' },
  { city: 'Kraków', country: 'Poland', region: 'Europe' },
  { city: 'Gdańsk', country: 'Poland', region: 'Europe' },
  { city: 'Brno', country: 'Czech Republic', region: 'Europe' },
  { city: 'Eindhoven', country: 'Netherlands', region: 'Europe' },
  { city: 'Düsseldorf', country: 'Germany', region: 'Europe' },
  { city: 'Marseille', country: 'France', region: 'Europe' },
  { city: 'Seville', country: 'Spain', region: 'Europe' },
  { city: 'Montpellier', country: 'France', region: 'Europe' },
  { city: 'Porto', country: 'Portugal', region: 'Europe' },
  { city: 'Podgorica', country: 'Montenegro', region: 'Europe' },
  { city: 'Tallinn', country: 'Estonia', region: 'Europe' },
  // Africa
  { city: 'Lagos', country: 'Nigeria', region: 'Africa' },
  { city: 'Abuja', country: 'Nigeria', region: 'Africa' },
  { city: 'Dakar', country: 'Senegal', region: 'Africa' },
  { city: 'Accra', country: 'Ghana', region: 'Africa' },
  { city: 'Nairobi', country: 'Kenya', region: 'Africa' },
  { city: 'Kinshasa', country: 'Congo', region: 'Africa' },
  { city: 'Luanda', country: 'Angola', region: 'Africa' },
  { city: 'Yaoundé', country: 'Cameroon', region: 'Africa' },
  { city: 'Tunis', country: 'Tunisia', region: 'Africa' },
  { city: 'Casablanca', country: 'Morocco', region: 'Africa' },
  // Asia / Oceania
  { city: 'Osaka', country: 'Japan', region: 'Asia' },
  { city: 'Busan', country: 'South Korea', region: 'Asia' },
  { city: 'Taipei', country: 'Taiwan', region: 'Asia' },
  { city: 'Manila', country: 'Philippines', region: 'Asia' },
  { city: 'Melbourne', country: 'Australia', region: 'Oceania' },
  { city: 'Auckland', country: 'New Zealand', region: 'Oceania' },
  { city: 'Beirut', country: 'Lebanon', region: 'Asia' },
  { city: 'Tel Aviv', country: 'Israel', region: 'Asia' },
  { city: 'Amman', country: 'Jordan', region: 'Asia' },
];

export const TEAM_NICKNAMES = [
  // Power / Nature
  'Thunderbolts', 'Cyclones', 'Avalanche', 'Wildcats', 'Wolves',
  'Falcons', 'Vipers', 'Cobras', 'Jaguars', 'Panthers',
  'Bears', 'Lions', 'Eagles', 'Hawks', 'Sharks',
  'Stallions', 'Rams', 'Bulls', 'Rhinos', 'Titans',
  // Abstract / Cool
  'Phantoms', 'Shadows', 'Blaze', 'Storm', 'Thunder',
  'Fury', 'Inferno', 'Blizzard', 'Tempest', 'Vortex',
  // Warriors / Battle
  'Gladiators', 'Spartans', 'Warriors', 'Knights', 'Crusaders',
  'Guardians', 'Sentinels', 'Defenders', 'Blazers', 'Chargers',
  // Unique / Creative
  'Monarchs', 'Emperors', 'Royals', 'Aces', 'Mavericks',
  'Renegades', 'Outlaws', 'Rebels', 'Pioneers', 'Voyagers',
  'Comets', 'Meteors', 'Rockets', 'Lasers', 'Dynamo',
];

export const STADIUM_SUFFIXES = [
  'Arena',
  'Center',
  'Dome',
  'Court',
  'Hall',
  'Coliseum',
  'Palace',
];
