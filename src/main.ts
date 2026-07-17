import { registerSW } from 'virtual:pwa-register';
import { GameApp } from './app/GameApp';
import './styles.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('App root is missing');

try {
  new GameApp(root);
} catch (error) {
  const message = error instanceof Error ? error.message : 'تعذر تشغيل اللعبة';
  root.innerHTML = `<main class="fatal-error" role="alert"><div><b>ما قدرنا نشغّل المدينة</b><p>${message}</p></div></main>`;
  console.error(error);
}

const updateSW = registerSW({
  onNeedRefresh() {
    const accepted = window.confirm('فيه تحديث جديد لمدينة محمد. تبي تحدث الآن؟');
    if (accepted) void updateSW(true);
  },
  onOfflineReady() {
    window.setTimeout(() => {
      document.querySelector<HTMLElement>('[data-status]')?.classList.add('is-offline-ready');
    }, 800);
  },
});
