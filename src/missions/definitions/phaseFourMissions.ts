export type StoryObjectiveKind = 'interaction' | 'zone' | 'vehicle-enter';

export interface StoryDialogue {
  speaker: string;
  lines: readonly string[];
}

export interface StoryObjectiveDefinition {
  id: string;
  title: string;
  kind: StoryObjectiveKind;
  targetId?: string;
  sequence?: readonly string[];
  requiredVehicleId?: string;
  onFootOnly?: boolean;
  radius?: number;
  timeLimitSeconds?: number;
  dialogue?: StoryDialogue;
}

export interface StoryMissionDefinition {
  id: string;
  number: number;
  title: string;
  objectives: readonly StoryObjectiveDefinition[];
  rewardVehicleId?: string;
}

export const PHASE_FOUR_MISSIONS: readonly StoryMissionDefinition[] = [
  {
    id: 'stolen-bicycle',
    number: 2,
    title: 'الدراجة المسروقة',
    rewardVehicleId: 'bicycle',
    objectives: [
      {
        id: 'friend-report',
        title: 'كلم صديق محمد في الحي',
        kind: 'interaction',
        targetId: 'friend-report',
        dialogue: { speaker: 'صديق محمد', lines: ['يا محمد، دراجتي اختفت من عند البيت!', 'لقيت أثر كفر عند الشارع، يمكن يفيدنا.'] },
      },
      { id: 'follow-tracks', title: 'تتبع آثار الدراجة', kind: 'zone', sequence: ['track-1', 'track-2', 'track-3'], onFootOnly: true, radius: 2.3 },
      {
        id: 'ask-first-witness',
        title: 'اسأل الشاهد الأول',
        kind: 'interaction',
        targetId: 'witness-one',
        dialogue: { speaker: 'الشاهد الأول', lines: ['شفت واحد يمشي بالدراجة جهة المحلات.', 'كان مستعجل ولف من عند المخبز.'] },
      },
      {
        id: 'ask-second-witness',
        title: 'اسأل الشاهد الثاني',
        kind: 'interaction',
        targetId: 'witness-two',
        dialogue: { speaker: 'الشاهد الثاني', lines: ['مر من هنا قبل شوي.', 'كاميرا المحل صورت الطريق كامل.'] },
      },
      { id: 'check-store-camera', title: 'افحص كاميرا المتجر', kind: 'interaction', targetId: 'store-camera' },
      { id: 'alley-chase', title: 'الحق المسار عبر الأزقة', kind: 'zone', sequence: ['chase-1', 'chase-2', 'chase-3', 'chase-4'], onFootOnly: true, radius: 2.4 },
      { id: 'recover-bicycle', title: 'استرجع الدراجة', kind: 'interaction', targetId: 'recover-bicycle' },
      { id: 'enter-bicycle', title: 'اركب الدراجة', kind: 'vehicle-enter', requiredVehicleId: 'bicycle' },
      { id: 'return-bicycle', title: 'رجع الدراجة لصديق محمد', kind: 'zone', targetId: 'return-bicycle', requiredVehicleId: 'bicycle', radius: 3.2 },
    ],
  },
  {
    id: 'street-races',
    number: 3,
    title: 'سباق الشوارع',
    rewardVehicleId: 'sport-car',
    objectives: [
      {
        id: 'garage-race-talk',
        title: 'كلم صاحب الكراج',
        kind: 'interaction',
        targetId: 'garage-race-talk',
        dialogue: { speaker: 'صاحب الكراج', lines: ['السيارة الرياضية جاهزة للتجربة.', 'ابدأ بالتدريب، وبعدها ندخل السباقات.'] },
      },
      { id: 'enter-sport-car', title: 'اركب السيارة الرياضية', kind: 'vehicle-enter', requiredVehicleId: 'sport-car' },
      { id: 'driving-training', title: 'أكمل مسار التدريب', kind: 'zone', sequence: ['training-1', 'training-2', 'training-3'], requiredVehicleId: 'sport-car', radius: 3.7 },
      { id: 'race-one', title: 'السباق الأول', kind: 'zone', sequence: ['race1-1', 'race1-2', 'race1-3', 'race1-4'], requiredVehicleId: 'sport-car', radius: 4, timeLimitSeconds: 42 },
      { id: 'race-two', title: 'السباق الثاني', kind: 'zone', sequence: ['race2-1', 'race2-2', 'race2-3', 'race2-4', 'race2-5'], requiredVehicleId: 'sport-car', radius: 4, timeLimitSeconds: 58 },
      { id: 'race-three', title: 'السباق الثالث', kind: 'zone', sequence: ['race3-1', 'race3-2', 'race3-3', 'race3-4', 'race3-5', 'race3-6'], requiredVehicleId: 'sport-car', radius: 4, timeLimitSeconds: 72 },
    ],
  },
  {
    id: 'abandoned-house',
    number: 4,
    title: 'المنزل المهجور',
    objectives: [
      {
        id: 'collect-old-key',
        title: 'خذ المفتاح القديم من صديق محمد',
        kind: 'interaction',
        targetId: 'old-key',
        dialogue: { speaker: 'صديق محمد', lines: ['لقيت هذا المفتاح داخل صندوق قديم.', 'يمكن يفتح البيت اللي بطرف الحي.'] },
      },
      { id: 'reach-old-house', title: 'اذهب إلى المنزل القديم', kind: 'zone', targetId: 'old-house-entry', onFootOnly: true, radius: 3 },
      { id: 'open-side-door', title: 'افتح المدخل الجانبي', kind: 'interaction', targetId: 'old-house-door' },
      { id: 'symbol-puzzle', title: 'حل ترتيب الرموز', kind: 'interaction', sequence: ['symbol-sun', 'symbol-wave', 'symbol-star'] },
      { id: 'open-hidden-room', title: 'افتح الغرفة المخفية', kind: 'interaction', targetId: 'hidden-room-latch' },
      { id: 'take-map-fragment', title: 'خذ جزء الخريطة الأول', kind: 'interaction', targetId: 'map-fragment' },
    ],
  },
  {
    id: 'secret-garage',
    number: 5,
    title: 'الكراج السري',
    rewardVehicleId: 'classic-car',
    objectives: [
      {
        id: 'garage-parts-talk',
        title: 'اسأل صاحب الكراج عن السيارة القديمة',
        kind: 'interaction',
        targetId: 'garage-parts-talk',
        dialogue: { speaker: 'صاحب الكراج', lines: ['ناقصنا ثلاث قطع عشان نشغل السيارة القديمة.', 'اجمعها ورجع لي، وبنركبها سوا.'] },
      },
      { id: 'collect-parts', title: 'اجمع قطع السيارة', kind: 'interaction', sequence: ['part-battery', 'part-belt', 'part-toolkit'] },
      { id: 'repair-classic', title: 'ركب القطع بالترتيب', kind: 'interaction', sequence: ['repair-belt', 'repair-battery', 'repair-panel'] },
      { id: 'start-classic', title: 'شغّل السيارة القديمة', kind: 'interaction', targetId: 'start-classic' },
      { id: 'enter-classic', title: 'اركب السيارة القديمة', kind: 'vehicle-enter', requiredVehicleId: 'classic-car' },
      { id: 'test-classic', title: 'اختبر السيارة في الطريق', kind: 'zone', sequence: ['classic-test-1', 'classic-test-2', 'classic-test-3'], requiredVehicleId: 'classic-car', radius: 4 },
      { id: 'drawer-clue', title: 'افحص الدرج المخفي', kind: 'interaction', targetId: 'drawer-clue' },
    ],
  },
];
