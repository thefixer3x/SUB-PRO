import fs from 'fs';
import path from 'path';
import { FEATURE_CATALOG, PILLARS, featuresByPillar } from '@/config/featureCatalog';
import { SUBSCRIPTION_PLANS } from '@/config/subscriptionPlans';

const root = path.join(__dirname, '..');

/** '/(tabs)/analytics' -> app/(tabs)/analytics.tsx ; '/(tabs)' -> app/(tabs)/index.tsx */
function routeFile(route: string): string {
  const clean = route.replace(/^\//, '');
  const candidates = [
    path.join(root, 'app', `${clean}.tsx`),
    path.join(root, 'app', clean, 'index.tsx'),
    path.join(root, 'app', '(tabs)', `${clean}.tsx`),
  ];
  return candidates.find((c) => fs.existsSync(c)) ?? '';
}

describe('feature catalog', () => {
  it('has unique ids', () => {
    const ids = FEATURE_CATALOG.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(FEATURE_CATALOG.filter((f) => f.status !== 'coming_soon').map((f) => [f.id, f]))(
    '%s opens a screen that exists',
    (_id, feature) => {
      expect(feature.route).toBeTruthy();
      expect(routeFile(feature.route!)).not.toBe('');
    },
  );

  it.each(FEATURE_CATALOG.filter((f) => f.status === 'pro').map((f) => [f.id, f]))(
    '%s is gated by a real plan limit that Free does not include',
    (_id, feature) => {
      expect(feature.gate).toBeTruthy();
      expect(SUBSCRIPTION_PLANS.free.limits[feature.gate!]).toBe(false);
      expect(SUBSCRIPTION_PLANS.pro.limits[feature.gate!]).toBeTruthy();
    },
  );

  it('coming-soon features cannot be opened', () => {
    for (const f of FEATURE_CATALOG.filter((x) => x.status === 'coming_soon')) {
      expect(f.route).toBeUndefined();
    }
  });

  it('every pillar has at least one live feature', () => {
    for (const pillar of Object.keys(PILLARS) as Array<keyof typeof PILLARS>) {
      expect(featuresByPillar(pillar).length).toBeGreaterThan(0);
    }
    expect(featuresByPillar('see').some((f) => f.status === 'live')).toBe(true);
  });
});
