/**
 * Keeps --app-width/--app-height in sync with the real visible viewport so
 * fixed full-screen overlays can size themselves correctly on iOS Safari,
 * where 100vw/100vh include space the on-screen toolbars actually cover.
 * 100dvw/100dvh (CSS) are preferred where supported; these variables are the
 * fallback for the boot overlay specifically.
 */
export class ViewportFit {
  private constructor() {}

  static install(): () => void {
    const update = (): void => {
      const width = window.visualViewport?.width ?? window.innerWidth;
      const height = window.visualViewport?.height ?? window.innerHeight;
      const root = document.documentElement.style;
      root.setProperty('--app-width', `${width}px`);
      root.setProperty('--app-height', `${height}px`);
    };

    update();
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('orientationchange', update, { passive: true });
    window.visualViewport?.addEventListener('resize', update, { passive: true });
    window.visualViewport?.addEventListener('scroll', update, { passive: true });

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }
}
