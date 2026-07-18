export class GameUI {
  readonly root: HTMLElement;
  private readonly menu: HTMLElement;
  private readonly hud: HTMLElement;
  private readonly controls: HTMLElement;
  private readonly pausePanel: HTMLElement;
  private readonly rotateOverlay: HTMLElement;
  private readonly status: HTMLElement;
  private readonly interactionPrompt: HTMLElement;
  private readonly completionPanel: HTMLElement;
  private readonly continueButton: HTMLButtonElement;
  private readonly missionTitle: HTMLElement;
  private readonly missionObjective: HTMLElement;
  private readonly interactButton: HTMLButtonElement;
  private readonly vehicleButton: HTMLButtonElement;
  private portrait = false;
  private playing = false;
  private paused = false;
  private missionComplete = false;
  private onStartHandler: ((resume: boolean) => void) | null = null;
  private onPauseHandler: ((paused: boolean) => void) | null = null;
  private onResetHandler: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    root.innerHTML = `
      <main class="game-shell" aria-label="مدينة محمد">
        <canvas id="game-canvas" aria-label="مشهد مدينة محمد ثلاثي الأبعاد" tabindex="0"></canvas>
        <section class="menu-screen" data-screen="menu">
          <div class="menu-atmosphere" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
          <div class="brand-lockup">
            <span class="eyebrow">مغامرة جديدة تبدأ من هنا</span>
            <h1>مدينة <em>محمد</em></h1>
            <p>MOHAMMED CITY</p>
          </div>
          <nav class="menu-actions" aria-label="القائمة الرئيسية">
            <button class="primary-button" data-menu-action="start"><span class="play-mark">▶</span><b>ابدأ مهمة جديدة</b><small>الهروب من المستودع</small></button>
            <button class="menu-button" data-menu-action="continue" disabled><b>متابعة</b><small>لا يوجد حفظ بعد</small></button>
            <button class="menu-button" data-menu-action="settings" disabled><b>الإعدادات</b><small>قريبًا</small></button>
          </nav>
          <div class="phase-chip"><span></span> المرحلة الثانية — Vertical Slice</div>
        </section>

        <section class="game-hud" data-screen="hud" aria-label="واجهة اللعب">
          <div class="mission-pill"><span class="mission-index">01</span><div><small data-mission-title>الهروب من المستودع</small><strong data-mission-objective>دور على لوحة الكهرباء داخل المستودع</strong></div></div>
          <div class="compass" aria-label="اتجاه الكاميرا"><span>ش</span><i></i></div>
          <div class="keyboard-hint">WASD حركة · E تفاعل · F ركوب/خروج · Esc إيقاف</div>
        </section>

        <section class="touch-controls" data-screen="controls" aria-label="أدوات التحكم باللمس">
          <div class="joystick-zone" data-control="joystick" aria-label="عصا الحركة">
            <div class="joystick-ring"></div><div class="joystick-knob" data-control="joystick-knob"><i></i></div>
          </div>
          <div class="action-cluster">
            <button class="action-button run-button" data-action="run" aria-label="جري"><span>»</span><b>جري</b></button>
            <button class="action-button crouch-button" data-action="crouch" aria-label="انحناء"><span>⌄</span><b>انحناء</b></button>
            <button class="action-button jump-button" data-action="jump" aria-label="قفز"><span>↑</span><b>قفز</b></button>
          </div>
          <div class="context-action-cluster">
            <button class="context-action-button interact-button" data-action="interact" aria-label="تفاعل"><span>E</span><b>تفاعل</b></button>
            <button class="context-action-button vehicle-button" data-action="vehicle" aria-label="ركوب أو خروج" hidden><span>F</span><b>اركب</b></button>
          </div>
          <div class="camera-hint" aria-hidden="true"><i></i> اسحب لتحريك الكاميرا</div>
        </section>

        <section class="interaction-prompt" data-interaction-prompt hidden aria-live="polite"><kbd>E</kbd><strong></strong></section>

        <section class="pause-panel" data-screen="pause" role="dialog" aria-label="اللعبة متوقفة">
          <div><span class="eyebrow">استراحة قصيرة</span><h2>اللعبة متوقفة</h2><p>تقدم المهمة محفوظ على هذا الجهاز.</p><button class="primary-button compact" data-menu-action="resume"><b>متابعة اللعب</b></button><button class="reset-button" data-mission-reset>إعادة المهمة من البداية</button></div>
        </section>

        <section class="mission-complete-panel" data-screen="complete" role="dialog" aria-label="اكتملت المهمة">
          <div><span class="completion-mark">✓</span><small>المهمة 01</small><h2>كفو يا محمد!</h2><p>هربت من المستودع ووصلت إلى الكراج.</p><button class="primary-button compact" data-mission-reset><b>إعادة المهمة</b></button></div>
        </section>

        <section class="rotate-overlay" data-screen="rotate" role="alert">
          <div class="phone-rotate" aria-hidden="true"><i></i><span>↻</span></div>
          <h2>لف الجهاز عشان تلعب</h2>
          <p>مدينة محمد مصممة للوضع الأفقي</p>
        </section>

        <section class="status-toast" data-status role="status"></section>
        <aside class="debug-hud" data-debug hidden></aside>
        <aside class="input-debug-overlay" data-input-debug hidden aria-label="تشخيص الإدخال اللمسي"></aside>
      </main>`;

    this.menu = this.required('[data-screen="menu"]');
    this.hud = this.required('[data-screen="hud"]');
    this.controls = this.required('[data-screen="controls"]');
    this.pausePanel = this.required('[data-screen="pause"]');
    this.rotateOverlay = this.required('[data-screen="rotate"]');
    this.status = this.required('[data-status]');
    this.interactionPrompt = this.required('[data-interaction-prompt]');
    this.completionPanel = this.required('[data-screen="complete"]');
    this.continueButton = this.required<HTMLButtonElement>('[data-menu-action="continue"]');
    this.missionTitle = this.required('[data-mission-title]');
    this.missionObjective = this.required('[data-mission-objective]');
    this.interactButton = this.required<HTMLButtonElement>('[data-action="interact"]');
    this.vehicleButton = this.required<HTMLButtonElement>('[data-action="vehicle"]');
    this.bindMenu();
    this.updateOrientation();
    window.addEventListener('resize', () => this.updateOrientation(), { passive: true });
    window.visualViewport?.addEventListener('resize', () => this.updateOrientation(), { passive: true });
  }

  onStart(handler: (resume: boolean) => void): void {
    this.onStartHandler = handler;
  }

  onPauseChange(handler: (paused: boolean) => void): void {
    this.onPauseHandler = handler;
  }

  onReset(handler: () => void): void {
    this.onResetHandler = handler;
  }

  setContinueAvailable(available: boolean): void {
    this.continueButton.disabled = !available;
    const detail = this.continueButton.querySelector('small');
    if (detail) detail.textContent = available ? 'آخر نقطة محفوظة' : 'لا يوجد حفظ بعد';
  }

  startGame(): void {
    this.playing = true;
    this.paused = false;
    this.missionComplete = false;
    this.menu.classList.add('is-hidden');
    this.pausePanel.classList.remove('is-visible');
    this.completionPanel.classList.remove('is-visible');
    this.refreshGameplayLayers();
  }

  togglePause(force?: boolean): void {
    if (!this.playing || this.portrait) return;
    this.paused = force ?? !this.paused;
    this.pausePanel.classList.toggle('is-visible', this.paused);
    this.refreshGameplayLayers();
    this.onPauseHandler?.(this.paused);
  }

  isPortrait(): boolean {
    return this.portrait;
  }

  isPaused(): boolean {
    return this.paused;
  }

  showStatus(message: string): void {
    this.status.textContent = message;
    this.status.classList.add('is-visible');
    window.setTimeout(() => this.status.classList.remove('is-visible'), 3200);
  }

  updateMission(title: string, objective: string): void {
    this.missionTitle.textContent = title;
    this.missionObjective.textContent = objective;
  }

  setInteractionPrompt(label: string | null): void {
    this.interactionPrompt.hidden = label === null;
    const text = this.interactionPrompt.querySelector('strong');
    if (text) text.textContent = label ?? '';
    this.interactButton.classList.toggle('is-available', label !== null);
  }

  setVehicleAction(label: string | null): void {
    this.vehicleButton.hidden = label === null;
    const text = this.vehicleButton.querySelector('b');
    if (text) text.textContent = label ?? '';
  }

  showMissionComplete(): void {
    this.missionComplete = true;
    this.completionPanel.classList.add('is-visible');
    this.setInteractionPrompt(null);
    this.setVehicleAction(null);
    this.refreshGameplayLayers();
  }

  updateDebug(html: string): void {
    const debug = this.required('[data-debug]');
    debug.hidden = false;
    debug.innerHTML = html;
  }

  private bindMenu(): void {
    this.root.querySelector('[data-menu-action="start"]')?.addEventListener('click', () => this.onStartHandler?.(false));
    this.root.querySelector('[data-menu-action="continue"]')?.addEventListener('click', () => this.onStartHandler?.(true));
    this.root.querySelector('[data-menu-action="resume"]')?.addEventListener('click', () => this.togglePause(false));
    this.root.querySelectorAll('[data-mission-reset]').forEach((button) => {
      button.addEventListener('click', () => this.onResetHandler?.());
    });
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Escape') this.togglePause();
    });
  }

  private updateOrientation(): void {
    const nextPortrait = window.innerHeight > window.innerWidth;
    if (nextPortrait === this.portrait) return;
    this.portrait = nextPortrait;
    this.rotateOverlay.classList.toggle('is-visible', this.portrait);
    this.refreshGameplayLayers();
  }

  private refreshGameplayLayers(): void {
    const show = this.playing && !this.paused && !this.portrait && !this.missionComplete;
    this.hud.classList.toggle('is-visible', show);
    this.controls.classList.toggle('is-visible', show);
  }

  private required<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing UI element: ${selector}`);
    return element;
  }
}
