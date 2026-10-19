// My listening history, baked from my self-hosted music server (snapshot mid-Sep
// 2026). These are the same numbers the static page showed; the charts compute
// their own geometry from them rather than shipping pre-rendered SVG.

export const kpis = [
  { value: '231,552', label: 'plays, all-time' },
  { value: '≈586 days', label: 'of continuous audio' },
  { value: '17,245', label: 'tracks in the library' },
  { value: '19%', label: 'played after dark' },
]

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Plays per month, 2014–2026. Each row is a calendar year of 12 months. */
export const monthly: { year: number; months: number[] }[] = [
  { year: 2014, months: [0, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0] },
  { year: 2015, months: [0, 3, 0, 75, 0, 0, 0, 0, 0, 0, 0, 349] },
  { year: 2016, months: [492, 295, 83, 27, 0, 0, 0, 58, 101, 179, 372, 425] },
  { year: 2017, months: [473, 576, 1644, 538, 897, 753, 855, 1267, 2865, 5269, 5103, 5913] },
  { year: 2018, months: [4112, 5250, 3399, 2146, 1422, 1403, 2249, 1752, 1705, 1831, 2661, 3270] },
  { year: 2019, months: [2380, 3027, 2752, 1891, 1767, 1884, 2273, 2012, 383, 538, 795, 328] },
  { year: 2020, months: [813, 977, 1198, 1751, 2344, 2029, 1831, 1612, 1764, 1736, 1525, 1721] },
  { year: 2021, months: [1703, 1170, 1897, 2445, 1822, 2105, 1906, 2326, 2088, 2844, 1887, 2125] },
  { year: 2022, months: [2849, 1758, 1825, 1859, 1734, 2108, 1750, 1575, 2058, 2377, 2305, 1856] },
  { year: 2023, months: [1960, 2962, 2449, 2675, 2265, 1993, 1657, 1805, 1208, 2355, 2592, 2611] },
  { year: 2024, months: [2648, 1785, 2259, 1259, 1306, 1342, 1849, 2136, 1677, 1204, 814, 2475] },
  { year: 2025, months: [2773, 606, 737, 1499, 1590, 729, 586, 626, 627, 332, 599, 551] },
  { year: 2026, months: [247, 37, 598, 983, 345, 821, 703, 1452, 1352, 0, 0, 0] },
]

/** All-time top ten artists. */
export const topArtists: { name: string; plays: number }[] = [
  { name: 'Aphex Twin', plays: 3345 },
  { name: 'Machine Girl', plays: 3027 },
  { name: 'Death Grips', plays: 2840 },
  { name: 'Casino Versus Japan', plays: 2810 },
  { name: 'Radiohead', plays: 2476 },
  { name: 'Deerhoof', plays: 2454 },
  { name: 'Gorillaz', plays: 2436 },
  { name: 'Boards of Canada', plays: 2300 },
  { name: 'Nick Drake', plays: 1969 },
  { name: 'King Gizzard & The Lizard Wizard', plays: 1938 },
]

/** The 4,533 tracks with real mood scores, by valence/intensity quadrant. */
export const moodQuadrants: { label: string; tracks: number; share: string }[] = [
  { label: 'sad · calm', tracks: 2321, share: '51%' },
  { label: 'happy · intense', tracks: 1452, share: '32%' },
  { label: 'sad · intense', tracks: 466, share: '10%' },
  { label: 'happy · calm', tracks: 294, share: '6%' },
]

/** Plays by hour of day (local time), from the 212,602 stamped plays. */
export const hourly: { hour: string; plays: number }[] = [
  { hour: '12am', plays: 7674 }, { hour: '1am', plays: 6208 }, { hour: '2am', plays: 4712 },
  { hour: '3am', plays: 4060 }, { hour: '4am', plays: 3415 }, { hour: '5am', plays: 3244 },
  { hour: '6am', plays: 3219 }, { hour: '7am', plays: 3415 }, { hour: '8am', plays: 4220 },
  { hour: '9am', plays: 7930 }, { hour: '10am', plays: 10862 }, { hour: '11am', plays: 12831 },
  { hour: '12pm', plays: 12934 }, { hour: '1pm', plays: 14608 }, { hour: '2pm', plays: 14090 },
  { hour: '3pm', plays: 13986 }, { hour: '4pm', plays: 12694 }, { hour: '5pm', plays: 12854 },
  { hour: '6pm', plays: 11636 }, { hour: '7pm', plays: 10361 }, { hour: '8pm', plays: 9519 },
  { hour: '9pm', plays: 9936 }, { hour: '10pm', plays: 9493 }, { hour: '11pm', plays: 8701 },
]
