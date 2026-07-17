import {
  ACESFilmicToneMapping,
  Clock,
  PCFSoftShadowMap,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { ThirdPersonCamera } from '../camera/ThirdPersonCamera';
import { InputManager } from '../controls/InputManager';
import { PlayerController } from '../entities/player/PlayerController';
import type { CharacterRenderMetrics } from '../entities/player/CharacterVisual';
import { GameUI } from '../ui/GameUI';
import { TestWorld } from '../world/TestWorld';

declare global {
  interface Window {
    __MC_TEST__?: {
      getState: () => {
        started: boolean;
        paused: boolean;
        portrait: boolean;
        grounded: boolean;
        crouching: boolean;
        player: { x: number; y: number; z: number };
        playerRootY: number;
        visualLocalY: number;
        cameraTargetY: number;
        characterPose: string;
        characterDrawCalls: number;
        characterTriangles: number;
        drawCalls: number;
        triangles: number;
      };
    };
  }
}

export class GameApp {
  private readonly ui: GameUI;
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: WebGLRenderer;
  private readonly world: TestWorld;
  private readonly player: PlayerController;
  private readonly cameraRig: ThirdPersonCamera;
  private readonly input: InputManager;
  private readonly characterMetrics: CharacterRenderMetrics;
  private readonly clock = new Clock(false);
  private started = false;
  private appPaused = false;
  private frameRequest = 0;
  private debugElapsed = 0;
  private debugFrameCount = 0;
  private debugFps = 0;
  private readonly frameTimes: number[] = [];
  private longTasks = 0;
  private readonly zeroCameraDelta = new Vector2();
  private readonly debugCameraTarget = new Vector3();
  private readonly debugEnabled = new URLSearchParams(window.location.search).has('debug');

  constructor(root: HTMLElement) {
    this.ui = new GameUI(root);
    const canvas = root.querySelector<HTMLCanvasElement>('#game-canvas');
    if (!canvas) throw new Error('Canvas was not created');
    this.canvas = canvas;

    const context = canvas.getContext('webgl2', {
      alpha: false,
      antialias: true,
      depth: true,
      powerPreference: 'high-performance',
    });
    if (!context) throw new Error('WebGL 2 غير متوفر على هذا الجهاز');

    this.renderer = new WebGLRenderer({
      canvas,
      context,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

    this.world = new TestWorld();
    const { collisions, cameraObstacles } = this.world.getResult();
    this.player = new PlayerController(collisions);
    this.characterMetrics = this.player.view.getRenderMetrics();
    this.world.scene.add(this.player.view.root);
    this.cameraRig = new ThirdPersonCamera(cameraObstacles);
    if (new URLSearchParams(window.location.search).has('characterPreview')) {
      this.cameraRig.distance = 3.35;
      this.cameraRig.pitch = 0.16;
      this.player.yaw = Math.PI;
      this.player.view.root.rotation.y = Math.PI;
    }
    this.input = new InputManager(canvas);

    this.ui.onStart(() => this.start());
    this.ui.onPauseChange((paused) => {
      this.appPaused = paused;
      if (!paused) this.clock.start();
    });

    this.installLifecycleHandlers();
    this.observeLongTasks();
    this.installTestBridge();
    this.resize();
    this.renderOnce();
    this.frameRequest = requestAnimationFrame((time) => this.loop(time));
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.appPaused = false;
    this.ui.startGame();
    this.clock.start();
    this.canvas.focus({ preventScroll: true });
    this.unlockAudioContext();
    this.ui.showStatus('جاهز يا محمد — جرّب الحركة والكاميرا');
  }

  dispose(): void {
    cancelAnimationFrame(this.frameRequest);
    this.renderer.dispose();
  }

  private loop(_time: number): void {
    this.frameRequest = requestAnimationFrame((time) => this.loop(time));
    const orientationPaused = this.ui.isPortrait();
    if (!this.started || this.appPaused || orientationPaused || document.hidden) {
      this.clock.getDelta();
      this.renderOnce();
      return;
    }

    const delta = Math.min(this.clock.getDelta(), 0.05);
    const input = this.input.sample();
    this.player.update(delta, input, this.cameraRig.yaw);
    this.cameraRig.update(delta, this.player.position, input.cameraDelta);
    this.renderer.render(this.world.scene, this.cameraRig.camera);
    this.updateDebug(delta);
  }

  private renderOnce(): void {
    this.cameraRig.update(1 / 60, this.player.position, this.zeroCameraDelta);
    this.renderer.render(this.world.scene, this.cameraRig.camera);
  }

  private resize(): void {
    const viewport = window.visualViewport;
    const width = Math.max(1, Math.round(viewport?.width ?? window.innerWidth));
    const height = Math.max(1, Math.round(viewport?.height ?? window.innerHeight));
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.cameraRig.resize(width, height);
  }

  private installLifecycleHandlers(): void {
    window.addEventListener('resize', () => this.resize(), { passive: true });
    window.visualViewport?.addEventListener('resize', () => this.resize(), { passive: true });
    document.addEventListener('visibilitychange', () => {
      this.appPaused = document.hidden || this.ui.isPaused();
      if (!this.appPaused && this.started) this.clock.start();
    });
    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.appPaused = true;
      this.ui.showStatus('توقف الرسم مؤقتًا — جاري استعادة المشهد');
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.appPaused = this.ui.isPaused();
      this.clock.start();
      this.ui.showStatus('رجع المشهد — كمل اللعب');
    });
    document.addEventListener('contextmenu', (event) => {
      if (event.target === this.canvas) event.preventDefault();
    });
  }

  private updateDebug(delta: number): void {
    if (!this.debugEnabled) return;
    this.debugElapsed += delta;
    this.debugFrameCount += 1;
    this.frameTimes.push(delta);
    if (this.frameTimes.length > 240) this.frameTimes.shift();
    if (this.debugElapsed >= 0.5) {
      this.debugFps = this.debugFrameCount / this.debugElapsed;
      this.debugElapsed = 0;
      this.debugFrameCount = 0;
    }
    const info = this.renderer.info;
    const sortedFrames = [...this.frameTimes].sort((a, b) => b - a);
    const slowIndex = Math.min(sortedFrames.length - 1, Math.max(0, Math.floor(sortedFrames.length * 0.01)));
    const onePercentLow = sortedFrames.length ? 1 / Math.max(sortedFrames[slowIndex], 0.001) : 0;
    this.cameraRig.getSmoothedTarget(this.debugCameraTarget);
    this.ui.updateDebug([
      `<b>${this.debugFps.toFixed(0)} FPS</b>`,
      `Player Y: ${this.player.position.y.toFixed(3)}`,
      `Root Y: ${this.player.view.root.position.y.toFixed(3)}`,
      `Visual local Y: ${this.player.view.visualRoot.position.y.toFixed(3)}`,
      `Camera target Y: ${this.debugCameraTarget.y.toFixed(3)}`,
      `Grounded: ${this.player.grounded}`,
      `Pose: ${this.player.view.getPoseName()}`,
      `Character calls: ${this.characterMetrics.drawCalls}`,
      `Character tris: ${Math.round(this.characterMetrics.triangles).toLocaleString('en')}`,
      `1% low: ${onePercentLow.toFixed(0)}`,
      `Draw calls: ${info.render.calls}`,
      `Triangles: ${info.render.triangles.toLocaleString('en')}`,
      `Textures: ${info.memory.textures}`,
      'NPCs: 0',
      'Zones: test-zone',
      `Geometry: ${info.memory.geometries}`,
      'Memory: browser N/A',
      `Long tasks: ${this.longTasks}`,
    ].join('<br>'));
  }

  private observeLongTasks(): void {
    if (!('PerformanceObserver' in window)) return;
    try {
      const observer = new PerformanceObserver((list) => {
        this.longTasks += list.getEntries().length;
      });
      observer.observe({ entryTypes: ['longtask'] });
    } catch {
      // Safari versions without the Long Tasks API simply omit this counter.
    }
  }

  private unlockAudioContext(): void {
    const AudioContextConstructor = window.AudioContext;
    if (!AudioContextConstructor) return;
    const context = new AudioContextConstructor();
    void context.resume().finally(() => void context.close());
  }

  private installTestBridge(): void {
    window.__MC_TEST__ = {
      getState: () => {
        this.cameraRig.getSmoothedTarget(this.debugCameraTarget);
        return {
          started: this.started,
          paused: this.appPaused,
          portrait: this.ui.isPortrait(),
          grounded: this.player.grounded,
          crouching: this.player.crouching,
          player: { x: this.player.position.x, y: this.player.position.y, z: this.player.position.z },
          playerRootY: this.player.view.root.position.y,
          visualLocalY: this.player.view.visualRoot.position.y,
          cameraTargetY: this.debugCameraTarget.y,
          characterPose: this.player.view.getPoseName(),
          characterDrawCalls: this.characterMetrics.drawCalls,
          characterTriangles: this.characterMetrics.triangles,
          drawCalls: this.renderer.info.render.calls,
          triangles: this.renderer.info.render.triangles,
        };
      },
    };
  }
}
