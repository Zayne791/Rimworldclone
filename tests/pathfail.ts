// Who keeps failing to find paths? Runs the soak colony (with its auto-player) for N days.
import { PATH_STATS } from '../src/sim/path';
PATH_STATS.failBy = {};
process.argv[2] = process.argv[2] || '2';
await import('./simtest');
const top = Object.entries(PATH_STATS.failBy!).sort((a, b) => b[1] - a[1]).slice(0, 15);
console.log('FAILS BY', JSON.stringify(top));
