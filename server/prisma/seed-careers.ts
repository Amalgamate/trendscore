/**
 * Compatibility entry point for `npm run seed:careers`.
 *
 * Keep one canonical catalogue: the same idempotent seeder is used by the
 * admin API and by local maintenance scripts, so the two paths cannot drift
 * into different family codes or career counts.
 */
import { seedCareers } from '../src/services/career-seed.service';

if (require.main === module) {
  seedCareers()
    .then(result => {
      console.log(`Seeded ${result.careers} careers across ${result.families} families with ${result.routes} routes.`);
    })
    .catch(error => {
      console.error('Career seed error:', error);
      process.exitCode = 1;
    });
}
