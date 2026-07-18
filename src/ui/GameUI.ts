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
  private readonly dialoguePanel: HTMLElement;
  private readonly dialogueSpeaker: HTMLElement;
  private readonly dialogueText: HTMLElement;
  private readonly dialogueNextButton: HTMLButtonElement;
  private readonly mapPanel: HTMLElement;
  private readonly mapPlayer: HTMLElement;
  private readonly mapTarget: HTMLElement;
  private readonly continueButton: HTMLButtonElement;
  private readonly missionIndex: HTMLElement;
  private readonly missionTitle: HTMLElement;
  private readonly missionObjective: HTMLElement;
  private readonly interactButton: HTMLButtonElement;
  private readonly vehicleButton: HTMLButtonElement;
  private portrait = false;
  private playing = false;
  private paused = false;
  private missionComplete = false;
  private mapOpen = false;
  private dialogueOpen = false;
  private dialogueLines: readonly string[] = [];
  private dialogueIndex = 0;
  private dialogueCompleteHandler: (() => void) | null = null;
  private onStartHandler: ((resume: boolean) => void) | null = null;
  private onPauseHandler: ((paused: boolean) => void) | null = null;
  private onResetHandler: (() => void) | null = null;
  private onExploreCityHandler: (() => void) | null = null;
  private onModalChangeHandler: ((open: boolean) => void) | null = null;

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
          <div class="phase-chip"><span></span> المرحلة الرابعة — مغامرات المدينة</div>
        </section>

        <section class="game-hud" data-screen="hud" aria-label="واجهة اللعب">
          <div class="mission-pill"><span class="mission-index">01</span><div><small data-mission-title>الهروب من المستودع</small><strong data-mission-objective>دور على لوحة الكهرباء داخل المستودع</strong></div></div>
          <div class="compass" aria-label="اتجاه الكاميرا"><span>ش</span><i></i></div>
          <button class="map-toggle-button" data-ui-action="map" aria-label="افتح خريطة المدينة"><span>◇</span><b>الخريطة</b></button>
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
          <div><span class="completion-mark">✓</span><small>المهمة 01</small><h2>كفو يا محمد!</h2><p>هربت من المستودع ووصلت إلى الكراج. المدينة صارت مفتوحة للاستكشاف.</p><button class="primary-button compact" data-explore-city><b>ادخل المدينة</b></button><button class="reset-button" data-mission-reset>إعادة المهمة</button></div>
        </section>

        <section class="city-map-panel" data-screen="map" role="dialog" aria-label="خريطة مدينة محمد">
          <div class="city-map-card">
            <header><div><small>مدينة محمد</small><h2>خريطة المدينة</h2></div><button data-ui-action="close-map" aria-label="إغلاق الخريطة">×</button></header>
            <div class="city-map-canvas" aria-label="مناطق المدينة">
              <i class="map-road horizontal"></i><i class="map-road vertical"></i>
              <span class="map-zone neighborhood">حي محمد</span>
              <span class="map-zone commercial">الشارع التجاري</span>
              <span class="map-zone warehouses">المستودعات</span>
              <span class="map-zone garages">الكراجات</span>
              <span class="map-zone old-house">المنزل القديم</span>
              <i class="map-target-dot" data-map-target hidden></i>
              <i class="map-player-dot" data-map-player></i>
            </div>
            <footer><span><i class="legend-player"></i> محمد</span><span><i class="legend-target"></i> الهدف الحالي</span><small>اضغط M لفتح وإغلاق الخريطة</small></footer>
          </div>
        </section>

        <section class="dialogue-panel" data-screen="dialogue" role="dialog" aria-label="حوار">
          <div class="dialogue-card">
            <span class="dialogue-avatar" aria-hidden="true">م</span>
            <div><small data-dialogue-speaker></small><p data-dialogue-text></p></div>
            <button class="dialogue-next" data-dialogue-next>متابعة</button>
            <button class="dialogue-skip" data-dialogue-skip>تخطي</button>
          </div>
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
    this.dialoguePanel = this.required('[data-screen="dialogue"]');
    this.dialogueSpeaker = this.required('[data-dialogue-speaker]');
    this.dialogueText = this.required('[data-dialogue-text]');
    this.dialogueNextButton = this.required<HTMLButtonElement>('[data-dialogue-next]');
    this.mapPanel = this.required('[data-screen="map"]');
    this.mapPlayer = this.required('[data-map-player]');
    this.mapTarget = this.required('[data-map-target]');
    this.continueButton = this.required<HTMLButtonElement>('[data-menu-action="continue"]');
    this.missionIndex = this.required('.mission-index');
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

  onExploreCity(handler: () => void): void {
    this.onExploreCityHandler = handler;
  }

  onModalChange(handler: (open: boolean) => void): void {
    this.onModalChangeHandler = handler;
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
    this.mapOpen = false;
    this.dialogueOpen = false;
    this.menu.classList.add('is-hidden');
    this.pausePanel.classList.remove('is-visible');
    this.completionPanel.classList.remove('is-visible');
    this.mapPanel.classList.remove('is-visible');
    this.dialoguePanel.classList.remove('is-visible');
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

  updateMission(title: string, objective: string, index = '01'): void {
    this.missionIndex.textContent = index;
    this.missionTitle.textContent = title;
    this.missionObjective.textContent = objective;
  }

  enterCityExploration(): void {
    this.missionComplete = false;
    this.paused = false;
    this.completionPanel.classList.remove('is-visible');
    this.refreshGameplayLayers();
  }

  showDialogue(speaker: string, lines: readonly string[], onComplete: () => void): void {
    if (lines.length === 0) {
      onComplete();
      return;
    }
    this.dialogueLines = lines;
    this.dialogueIndex = 0;
    this.dialogueCompleteHandler = onComplete;
    this.dialogueOpen = true;
    this.dialogueSpeaker.textContent = speaker;
    this.renderDialogueLine();
    this.dialoguePanel.classList.add('is-visible');
    this.refreshGameplayLayers();
    this.onModalChangeHandler?.(true);
  }

  toggleMap(force?: boolean): void {
    if (!this.playing || this.portrait || this.missionComplete || this.dialogueOpen) return;
    this.mapOpen = force ?? !this.mapOpen;
    this.mapPanel.classList.toggle('is-visible', this.mapOpen);
    this.refreshGameplayLayers();
    this.onModalChangeHandler?.(this.mapOpen);
  }

  updateMap(playerX: number, playerZ: number, targetX?: number, targetZ?: number): void {
    this.placeMapDot(this.mapPlayer, playerX, playerZ);
    const hasTarget = typeof targetX === 'number' && typeof targetZ === 'number';
    this.mapTarget.hidden = !hasTarget;
    if (hasTarget) this.placeMapDot(this.mapTarget, targetX, targetZ);
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
    this.mapOpen = false;
    this.dialogueOpen = false;
    this.mapPanel.classList.remove('is-visible');
    this.dialoguePanel.classList.remove('is-visible');
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
    this.root.querySelector('[data-explore-city]')?.addEventListener('click', () => this.onExploreCityHandler?.());
    this.root.querySelector('[data-ui-action="map"]')?.addEventListener('click', () => this.toggleMap());
    this.root.querySelector('[data-ui-action="close-map"]')?.addEventListener('click', () => this.toggleMap(false));
    this.dialogueNextButton.addEventListener('click', () => this.advanceDialogue());
    this.root.querySelector('[data-dialogue-skip]')?.addEventListener('click', () => this.finishDialogue());
    this.root.querySelectorAll('[data-mission-reset]').forEach((button) => {
      button.addEventListener('click', () => this.onResetHandler?.());
    });
    window.addEventListener('keydown', (event) => {
      if (event.code === 'KeyM' && !event.repeat) this.toggleMap();
      if (event.code === 'Escape') {
        if (this.mapOpen) this.toggleMap(false);
        else if (!this.dialogueOpen) this.togglePause();
      }
      if ((event.code === 'Enter' || event.code === 'KeyE') && this.dialogueOpen && !event.repeat) {
        event.preventDefault();
        this.advanceDialogue();
      }
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
    const show = this.playing && !this.paused && !this.portrait && !this.missionComplete
      && !this.mapOpen && !this.dialogueOpen;
    this.hud.classList.toggle('is-visible', show);
    this.controls.classList.toggle('is-visible', show);
  }

  private renderDialogueLine(): void {
    this.dialogueText.textContent = this.dialogueLines[this.dialogueIndex] ?? '';
    this.dialogueNextButton.textContent = this.dialogueIndex >= this.dialogueLines.length - 1
      ? 'تم'
      : 'متابعة';
  }

  private advanceDialogue(): void {
    if (!this.dialogueOpen) return;
    if (this.dialogueIndex < this.dialogueLines.length - 1) {
      this.dialogueIndex += 1;
      this.renderDialogueLine();
      return;
    }
    this.finishDialogue();
  }

  private finishDialogue(): void {
    if (!this.dialogueOpen) return;
    const handler = this.dialogueCompleteHandler;
    this.dialogueOpen = false;
    this.dialogueLines = [];
    this.dialogueCompleteHandler = null;
    this.dialoguePanel.classList.remove('is-visible');
    this.refreshGameplayLayers();
    this.onModalChangeHandler?.(false);
    handler?.();
  }

  private placeMapDot(element: HTMLElement, x: number, z: number): void {
    const left = Math.max(2, Math.min(98, ((x + 54) / 108) * 100));
    const top = Math.max(2, Math.min(98, (1 - ((z + 16) / 76)) * 100));
    element.style.left = `${left.toFixed(2)}%`;
    element.style.top = `${top.toFixed(2)}%`;
  }

  private required<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing UI element: ${selector}`);
    return element;
  }
}
