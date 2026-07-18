import type { MissionDefinition } from '../runtime/MissionRuntime';

export const MISSION_ONE: MissionDefinition = {
  id: 'mission-01-warehouse-escape',
  title: 'الهروب من المستودع',
  version: 1,
  objectives: [
    {
      id: 'discover-panel',
      title: 'دور على لوحة الكهرباء داخل المستودع',
      markerId: 'power-panel',
      event: 'panel-discovered',
    },
    {
      id: 'power-sequence',
      title: 'شغّل القواطع بالترتيب: الأزرق، الأحمر، الأصفر',
      markerId: 'breaker-blue',
      sequence: ['breaker-blue', 'breaker-red', 'breaker-yellow'],
    },
    {
      id: 'start-generator',
      title: 'شغّل المولد',
      markerId: 'generator',
      event: 'generator-started',
    },
    {
      id: 'open-main-door',
      title: 'افتح باب المستودع الرئيسي',
      markerId: 'door-control',
      event: 'door-opened',
    },
    {
      id: 'exit-warehouse',
      title: 'اخرج إلى الشارع',
      markerId: 'warehouse-exit',
      event: 'warehouse-exited',
    },
    {
      id: 'enter-car',
      title: 'اركب السيارة المتوقفة قدام المستودع',
      markerId: 'mission-car',
      event: 'vehicle-entered',
    },
    {
      id: 'reach-garage',
      title: 'قد السيارة إلى الكراج',
      markerId: 'garage-goal',
      event: 'garage-reached',
    },
  ],
};
