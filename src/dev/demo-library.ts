import type { ProcessRepository } from '@/src/ports/process-repository';
import type { UserId } from '@/src/domain/types';

export type SeedDemoLibraryOptions = {
  /** When true, seed even if the owner already has live processes. */
  force?: boolean;
};

type StepSpec = {
  body: string;
  kind?: 'action' | 'heading' | 'note';
  optional?: boolean;
  notes?: string;
  url?: string;
  /** Key of another process created in the same seed run. */
  include?: string;
};

type ProcessSpec = {
  key: string;
  title: string;
  notes?: string;
  pin?: boolean;
  steps: StepSpec[];
};

const SPECS: ProcessSpec[] = [
  {
    key: 'camera-body',
    title: 'Camera body check',
    notes: 'Quick readiness check before it goes in the bag.',
    steps: [
      { body: 'Before mounting', kind: 'heading' },
      { body: 'Insert charged battery' },
      { body: 'Confirm card has space', notes: 'Format only if you already offloaded.' },
      { body: 'Wipe sensor / rear element', optional: true },
      { body: 'Attach preferred lens' },
    ],
  },
  {
    key: 'pack-camera',
    title: 'Pack camera bag',
    notes: 'Weekend and travel kit. Nested body check stays live.',
    pin: true,
    steps: [
      { body: 'Power and media', kind: 'heading' },
      { body: 'Charge spare batteries' },
      { body: 'Pack spare cards in labeled pouch' },
      { body: 'Body', kind: 'heading' },
      { body: 'Camera body', include: 'camera-body' },
      { body: 'Pack 35mm and 85mm' },
      { body: 'Toss microfiber cloth', optional: true },
      {
        body: 'Weather cover',
        optional: true,
        url: 'https://www.example.com/rain-cover',
      },
    ],
  },
  {
    key: 'bike',
    title: 'Bike tune-up',
    pin: true,
    steps: [
      { body: 'Safety first', kind: 'heading' },
      { body: 'Check tire pressure' },
      { body: 'Inspect brake pads' },
      { body: 'Wipe and lube chain' },
      { body: 'Spin wheels; true if needed', optional: true },
      { body: 'Test gears under load' },
    ],
  },
  {
    key: 'glaze',
    title: 'Glaze sequence',
    notes: 'Same order every firing day.',
    steps: [
      { body: 'Prep', kind: 'heading' },
      { body: 'Wipe bisque dust' },
      { body: 'Wax foot' },
      { body: 'Stir glaze bucket fully' },
      { body: 'Dip or brush in planned layers' },
      { body: 'Clean glaze drips from foot' },
      { body: 'Log glaze combo on shelf tag', kind: 'note' },
    ],
  },
  {
    key: 'printer',
    title: '3D printer maintenance',
    steps: [
      { body: 'Cold checks', kind: 'heading' },
      { body: 'Clear bed of debris' },
      { body: 'Check nozzle for stringing' },
      { body: 'Re-level bed' },
      { body: 'Dry filament if humid', optional: true },
      { body: 'Run a small calibration cube', optional: true },
    ],
  },
  {
    key: 'sourdough',
    title: 'Sourdough bake day',
    steps: [
      { body: 'Morning', kind: 'heading' },
      { body: 'Feed starter; wait until peaked' },
      { body: 'Autolyse flour and water' },
      { body: 'Mix in salt and starter' },
      { body: 'Bulk ferment with folds' },
      { body: 'Shape, proof, score, bake' },
      { body: 'Cool at least an hour before slicing', kind: 'note' },
    ],
  },
  {
    key: 'weekend-pack',
    title: 'Weekend pack-out',
    steps: [
      { body: 'Shelter and sleep', kind: 'heading' },
      { body: 'Pack tent and stakes' },
      { body: 'Sleeping bag + pad' },
      { body: 'Kitchen', kind: 'heading' },
      { body: 'Stove, fuel, lighter' },
      { body: 'Meals and water filter' },
      { body: 'Headlamp with spare batteries', optional: true },
    ],
  },
  {
    key: 'guitar',
    title: 'Guitar practice setup',
    steps: [
      { body: 'Tune to concert pitch' },
      { body: 'Set metronome for the session' },
      { body: 'Warm-up scales (5 min)' },
      { body: 'Work the focus piece' },
      { body: 'Record a take', optional: true },
      { body: 'Loosen strings slightly if storing long-term', kind: 'note' },
    ],
  },
  {
    key: 'garden',
    title: 'Garden bed prep',
    steps: [
      { body: 'Clear weeds and spent growth' },
      { body: 'Loosen soil in planting zone' },
      { body: 'Amend with compost' },
      { body: 'Water deeply before planting' },
      { body: 'Mulch after planting', optional: true },
    ],
  },
  {
    key: 'oil-change',
    title: 'Car oil change',
    steps: [
      { body: 'Warm engine briefly; park level' },
      { body: 'Drain oil; replace crush washer' },
      { body: 'Swap oil filter' },
      { body: 'Refill to spec; check for leaks' },
      { body: 'Reset oil-life indicator' },
      {
        body: 'Dispose of oil at recycler',
        url: 'https://www.example.com/oil-recycle',
      },
    ],
  },
];

/**
 * Seeds a realistic hobby library through the process port.
 * Safe to call from __DEV__ UI; no-ops when the owner already has live processes
 * unless `force` is set.
 */
export async function seedDemoLibrary(
  processes: ProcessRepository,
  ownerId: UserId,
  options: SeedDemoLibraryOptions = {},
): Promise<{ seeded: boolean; count: number }> {
  const existing = await processes.listProcesses(ownerId);
  if (existing.length > 0 && !options.force) {
    return { seeded: false, count: existing.length };
  }

  const byKey = new Map<string, string>();

  for (const spec of SPECS) {
    const created = await processes.createProcess({
      ownerId,
      title: spec.title,
      notes: spec.notes,
    });
    byKey.set(spec.key, created.id);
  }

  for (const spec of SPECS) {
    const processId = byKey.get(spec.key);
    if (!processId) continue;

    for (const step of spec.steps) {
      const childProcessId = step.include ? byKey.get(step.include) ?? null : null;
      await processes.createStep({
        processId,
        body: step.body,
        kind: step.kind ?? 'action',
        optional: step.optional,
        notes: step.notes,
        url: step.url ?? null,
        childProcessId,
      });
    }

    if (spec.pin) {
      await processes.pinProcess(processId);
    }
  }

  return { seeded: true, count: SPECS.length };
}
