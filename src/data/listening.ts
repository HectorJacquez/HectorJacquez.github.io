// My listening history, regenerated from the live music server by
// scripts/sync-listening-stats.py on 2026-10-23. Do not hand-edit: rerun the script.
// Plays/top-artists/days/library come from the hub's merged-play-store stats
// (Navidrome already folds in the imported Spotify + MusicBee history); the dated
// grids come from the Spotify archive (through Aug 2026) and the live Navidrome
// scrobble log (Aug 2026 on) -- the one window where the two are separable.

export const kpis = [
  { value: '232,147', label: 'plays, all-time' },
  { value: '≈588 days', label: 'of continuous audio' },
  { value: '17,245', label: 'tracks in the library' },
  { value: '19%', label: 'played after dark' },
]

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Plays per month, split by source. `spotify` is the dated Spotify archive
 *  (2014 - Aug 2026); `navidrome` is the live self-hosted scrobble log, which
 *  only begins Aug 2026 (the handoff). Charts read the sum for totals and the
 *  split to show the migration. 5,709 dated Navidrome plays so far. */
export const monthly: { year: number; spotify: number[]; navidrome: number[] }[] = [
  { year: 2014, spotify: [0, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0], navidrome: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { year: 2015, spotify: [0, 3, 0, 75, 0, 0, 0, 0, 0, 0, 0, 349], navidrome: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { year: 2016, spotify: [492, 295, 83, 27, 0, 0, 0, 58, 101, 178, 365, 424], navidrome: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { year: 2017, spotify: [470, 554, 1627, 538, 896, 753, 855, 1267, 2864, 5269, 5103, 5912], navidrome: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { year: 2018, spotify: [4112, 5250, 3398, 2146, 1422, 1403, 2249, 1752, 1705, 1831, 2661, 3269], navidrome: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { year: 2019, spotify: [2380, 3027, 2751, 1890, 1767, 1884, 2272, 2012, 383, 538, 793, 328], navidrome: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { year: 2020, spotify: [813, 977, 1198, 1751, 2343, 2029, 1826, 1612, 1733, 1626, 1523, 1716], navidrome: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { year: 2021, spotify: [1702, 1170, 1897, 2444, 1813, 2104, 1906, 2326, 2088, 2844, 1887, 2125], navidrome: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { year: 2022, spotify: [2673, 1758, 1825, 1859, 1728, 2105, 1749, 1575, 2057, 2376, 2305, 1856], navidrome: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { year: 2023, spotify: [1960, 2962, 2449, 2675, 2265, 1993, 1657, 1805, 1208, 2355, 2592, 2611], navidrome: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { year: 2024, spotify: [2648, 1785, 2259, 1259, 1306, 1342, 1849, 2136, 1677, 1204, 814, 2475], navidrome: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { year: 2025, spotify: [2773, 606, 737, 1499, 1590, 729, 586, 626, 627, 332, 599, 551], navidrome: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { year: 2026, spotify: [247, 37, 598, 983, 345, 821, 703, 129, 0, 0, 0, 0], navidrome: [0, 0, 0, 0, 0, 0, 0, 1368, 2590, 1751, 0, 0] },
]

/** All-time top ten artists. */
export const topArtists: { name: string; plays: number }[] = [
  { name: 'Aphex Twin', plays: 3347 },
  { name: 'Machine Girl', plays: 3041 },
  { name: 'Death Grips', plays: 2846 },
  { name: 'Casino Versus Japan', plays: 2825 },
  { name: 'Radiohead', plays: 2482 },
  { name: 'Deerhoof', plays: 2460 },
  { name: 'Gorillaz', plays: 2442 },
  { name: 'Boards of Canada', plays: 2307 },
  { name: 'Nick Drake', plays: 1971 },
  { name: 'King Gizzard & The Lizard Wizard', plays: 1938 },
]

/** The 10,701 tracks with mood scores, by valence/intensity quadrant.
 *  Full library scored as of 2026-10-23. */
export const moodQuadrants: { label: string; tracks: number; share: string }[] = [
  { label: 'sad · calm', tracks: 5544, share: '52%' },
  { label: 'happy · intense', tracks: 3437, share: '32%' },
  { label: 'sad · intense', tracks: 866, share: '8%' },
  { label: 'happy · calm', tracks: 854, share: '8%' },
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
