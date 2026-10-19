// My listening history, regenerated from the live music server by
// scripts/sync-listening-stats.py on 2026-10-19. Do not hand-edit: rerun the script.
// Plays/top-artists/days/library come from the hub's merged-play-store stats
// (Navidrome + non-library Spotify, de-duplicated); the dated month grid and the
// hour clock come from the Spotify export (the only source with timestamps).

export const kpis = [
  { value: '231,854', label: 'plays, all-time' },
  { value: '≈587 days', label: 'of continuous audio' },
  { value: '17,245', label: 'tracks in the library' },
  { value: '19%', label: 'played after dark' },
]

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Plays per month. Each row is a calendar year of 12 months. */
export const monthly: { year: number; months: number[] }[] = [
  { year: 2014, months: [0, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0] },
  { year: 2015, months: [0, 3, 0, 75, 0, 0, 0, 0, 0, 0, 0, 349] },
  { year: 2016, months: [492, 295, 83, 27, 0, 0, 0, 58, 101, 178, 365, 424] },
  { year: 2017, months: [470, 554, 1627, 538, 896, 753, 855, 1267, 2864, 5269, 5103, 5912] },
  { year: 2018, months: [4112, 5250, 3398, 2146, 1422, 1403, 2249, 1752, 1705, 1831, 2661, 3269] },
  { year: 2019, months: [2380, 3027, 2751, 1890, 1767, 1884, 2272, 2012, 383, 538, 793, 328] },
  { year: 2020, months: [813, 977, 1198, 1751, 2343, 2029, 1826, 1612, 1733, 1626, 1523, 1716] },
  { year: 2021, months: [1702, 1170, 1897, 2444, 1813, 2104, 1906, 2326, 2088, 2844, 1887, 2125] },
  { year: 2022, months: [2673, 1758, 1825, 1859, 1728, 2105, 1749, 1575, 2057, 2376, 2305, 1856] },
  { year: 2023, months: [1960, 2962, 2449, 2675, 2265, 1993, 1657, 1805, 1208, 2355, 2592, 2611] },
  { year: 2024, months: [2648, 1785, 2259, 1259, 1306, 1342, 1849, 2136, 1677, 1204, 814, 2475] },
  { year: 2025, months: [2773, 606, 737, 1499, 1590, 729, 586, 626, 627, 332, 599, 551] },
  { year: 2026, months: [247, 37, 598, 983, 345, 821, 703, 129, 0, 0, 0, 0] },
]

/** All-time top ten artists. */
export const topArtists: { name: string; plays: number }[] = [
  { name: 'Aphex Twin', plays: 3346 },
  { name: 'Machine Girl', plays: 3035 },
  { name: 'Death Grips', plays: 2845 },
  { name: 'Casino Versus Japan', plays: 2817 },
  { name: 'Radiohead', plays: 2479 },
  { name: 'Deerhoof', plays: 2457 },
  { name: 'Gorillaz', plays: 2439 },
  { name: 'Boards of Canada', plays: 2300 },
  { name: 'Nick Drake', plays: 1969 },
  { name: 'King Gizzard & The Lizard Wizard', plays: 1938 },
]

/** The 4,535 tracks with mood scores, by valence/intensity quadrant.
 *  The Listening page holds this chart until the analyzer finishes the library. */
export const moodQuadrants: { label: string; tracks: number; share: string }[] = [
  { label: 'sad · calm', tracks: 2321, share: '51%' },
  { label: 'happy · intense', tracks: 1454, share: '32%' },
  { label: 'sad · intense', tracks: 466, share: '10%' },
  { label: 'happy · calm', tracks: 294, share: '6%' },
]

/** Plays by hour of day (local time), from the 209,512 stamped plays. */
export const hourly: { hour: string; plays: number }[] = [
  { hour: '12am', plays: 7562 },
  { hour: '1am', plays: 6113 },
  { hour: '2am', plays: 4653 },
  { hour: '3am', plays: 4005 },
  { hour: '4am', plays: 3386 },
  { hour: '5am', plays: 3220 },
  { hour: '6am', plays: 3156 },
  { hour: '7am', plays: 3389 },
  { hour: '8am', plays: 4167 },
  { hour: '9am', plays: 7799 },
  { hour: '10am', plays: 10687 },
  { hour: '11am', plays: 12623 },
  { hour: '12pm', plays: 12731 },
  { hour: '1pm', plays: 14426 },
  { hour: '2pm', plays: 13898 },
  { hour: '3pm', plays: 13784 },
  { hour: '4pm', plays: 12500 },
  { hour: '5pm', plays: 12636 },
  { hour: '6pm', plays: 11468 },
  { hour: '7pm', plays: 10213 },
  { hour: '8pm', plays: 9345 },
  { hour: '9pm', plays: 9824 },
  { hour: '10pm', plays: 9364 },
  { hour: '11pm', plays: 8563 },
]
