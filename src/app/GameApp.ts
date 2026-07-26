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
import { SimpleVehicleController } from '../entities/vehicles/SimpleVehicleController';
import { PlayerController } from '../entities/player/PlayerController';
import type { CharacterGestureName, CharacterRenderMetrics } from '../entities/player/CharacterVisual';
import { MohammedGlbCharacter } from '../entities/player/MohammedGlbCharacter';
import { assetRegistry, CITY_MODEL_URLS } from '../assets/AssetRegistry';
import { cityAssetCache } from '../assets/GlbModelCache';
import { collectibleIds } from '../world/StoryWorld';
import { InteractionSystem, type InteractableDefinition } from '../interactions/InteractionSystem';
import { MISSION_ONE } from '../missions/definitions/missionOne';
import { MissionOneDirector, type MissionFeedback } from '../missions/runtime/MissionOneDirector';
import { MissionRuntime } from '../missions/runtime/MissionRuntime';
import { PHASE_FOUR_MISSIONS } from '../missions/definitions/phaseFourMissions';
import { StoryMissionDirector, type StoryFeedback } from '../missions/runtime/StoryMissionDirector';
import { StoryMissionRuntime } from '../missions/runtime/StoryMissionRuntime';
import { BrowserMissionStorage } from '../save/BrowserMissionStorage';
import { GameUI } from '../ui/GameUI';
import { CityDistricts } from '../world/CityDistricts';
import { MissionOneWorld } from '../world/MissionOneWorld';

// A viewport whose shorter side is at most this many CSS pixels is treated as
// a phone screen (this also matches the 844x390 iPhone-landscape size used by
// the e2e suite), independent of the desktop camera tuning below.
const MOBILE_VIEWPORT_MAX_DIMENSION = 520;
// Mohammed is 1.74m tall (MohammedGlbCharacter's TARGET_NET_HEIGHT) and the
// camera looks at CAMERA_TARGET_HEIGHT=1.28m, so the feet — not the head —
// are the binding crop constraint at 1.28m below the look-at point. At the
// rig's 58 degree vertical FOV that puts the theoretical crop floor at
// 1.28 / tan(29 deg) =~ 2.31m; these picks keep >=15% clearance above it
// while sitting materially closer than the shared desktop distances below.
const MOBILE_OUTDOOR_DISTANCE = 3.0;
const MOBILE_INDOOR_DISTANCE = 2.7;
const MOBILE_VEHICLE_DISTANCE_SCALE = 0.65;

const storyGreetingIds = new Set([
  'friend-report', 'witness-one', 'witness-two', 'garage-race-talk', 'garage-parts-talk',
]);
const storyDoorIds = new Set(['old-house-door', 'hidden-room-latch']);

function storyGestureFor(interactionId: string): CharacterGestureName {
  if (collectibleIds.has(interactionId)) return 'pickUp';
  if (storyGreetingIds.has(interactionId)) return 'wave';
  if (storyDoorIds.has(interactionId)) return 'openDoor';
  return 'positiveResponse';
}

declare global {
  interface Window {
    __MC_TEST__?: {
      getState: () => {
        started: boolean;
        paused: boolean;
        portrait: boolean;
        grounded: boolean;
        crouching: boolean;
        playerControlEnabled: boolean;
        playerVisible: boolean;
        playerOverlappingCollider: boolean;
        player: { x: number; y: number; z: number };
        playerRootY: number;
        visualLocalY: number;
        cameraTargetY: number;
        cameraDistance: number;
        missionObjective: string | null;
        missionSequence: number;
        missionCompleted: boolean;
        generatorOn: boolean;
        doorOpen: boolean;
        vehicleOccupied: boolean;
        vehicleSpeed: number;
        vehicle: { x: number; y: number; z: number };
        characterPose: string;
        characterClip: string | null;
        characterDrawCalls: number;
        characterTriangles: number;
        drawCalls: number;
        triangles: number;
        freeRoam: boolean;
        cityLocation: string;
        activeZones: string[];
        zoneStates: Readonly<Record<string, string>>;
        activeNPCs: number;
        insideInterior: boolean;
        activeVehicleId: string | null;
        storyMission: string | null;
        storyObjective: string | null;
        storySequence: number;
        storyCompleted: boolean;
      };
      teleportPlayer: (x: number, y: number, z: number, yaw?: number) => void;
      playGesture: (name: string) => boolean;
      teleportActiveVehicle: (x: number, z: number, yaw?: number) => void;
      setCameraYaw: (yaw: number) => void;
      resetMission: () => void;
      enterCity: () => void;
    };
  }
}

export class GameApp {
  private readonly ui: GameUI;
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: WebGLRenderer;
  private readonly world: MissionOneWorld;
  private readonly player: PlayerController;
  private readonly vehicle: SimpleVehicleController;
  private readonly cameraRig: ThirdPersonCamera;
  private readonly input: InputManager;
  private readonly missionRuntime: MissionRuntime;
  private readonly missionDirector: MissionOneDirector;
  private readonly storyRuntime: StoryMissionRuntime;
  private readonly storyDirector: StoryMissionDirector;
  private readonly interactionSystem: InteractionSystem;
  private characterMetrics: CharacterRenderMetrics;
  private glbCharacter: MohammedGlbCharacter | null = null;
  // Reassigned once the boot overlay's first tap kicks off the real load;
  // the resolved placeholder keeps `start()` safe even if it were somehow
  // reachable before that (it never is: the menu stays hidden until then).
  private characterReady: Promise<void> = Promise.resolve();
  private bootStarted = false;
  private readonly clock = new Clock(false);
  private started = false;
  private startPending = false;
  private freeRoam = false;
  private appPaused = false;
  private frameRequest = 0;
  private debugElapsed = 0;
  private debugFrameCount = 0;
  private debugFps = 0;
  private readonly frameTimes: number[] = [];
  private longTasks = 0;
  private activeCityInteraction: InteractableDefinition | null = null;
  private activeStoryInteractionId: string | null = null;
  private interactionSource: 'story' | 'city' | null = null;
  private nearbyVehicle: SimpleVehicleController | null = null;
  private readonly vehicles: SimpleVehicleController[] = [];
  private storyVehiclesInitialized = false;
  private readonly zeroCameraDelta = new Vector2();
  private readonly debugCameraTarget = new Vector3();
  private readonly cameraFollowTarget = new Vector3();
  private readonly debugEnabled = new URLSearchParams(window.location.search).has('debug');
  private isMobileViewport = false;

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

    this.world = new MissionOneWorld();
    const { collisions, cameraObstacles } = this.world.getResult();
    this.player = new PlayerController(collisions);
    this.player.teleport(this.world.spawnPoint, Math.PI);
    this.characterMetrics = this.player.view.getRenderMetrics();
    this.world.scene.add(this.player.view.root);
    this.vehicle = new SimpleVehicleController(collisions, this.world.vehicleSpawn);
    this.vehicles.push(this.vehicle);
    this.world.scene.add(this.vehicle.root);
    this.missionRuntime = new MissionRuntime(MISSION_ONE, new BrowserMissionStorage());
    this.interactionSystem = new InteractionSystem(collisions);
    this.missionDirector = new MissionOneDirector(
      this.missionRuntime,
      this.world,
      this.interactionSystem,
    );
    this.storyRuntime = new StoryMissionRuntime(PHASE_FOUR_MISSIONS, new BrowserMissionStorage());
    this.storyDirector = new StoryMissionDirector(
      this.storyRuntime,
      this.world.story,
      this.interactionSystem,
    );
    this.cameraRig = new ThirdPersonCamera(cameraObstacles);
    this.cameraRig.yaw = Math.PI;
    if (new URLSearchParams(window.location.search).has('characterPreview')) {
      this.cameraRig.distance = 3.35;
      this.cameraRig.pitch = 0.16;
      this.player.yaw = Math.PI;
      this.player.view.root.rotation.y = Math.PI;
    }
    this.input = new InputManager(canvas);

    this.ui.setContinueAvailable(this.missionRuntime.hasSavedProgress());
    this.ui.onBootTap(() => this.handleBootTap());
    this.ui.onStart((resume) => this.start(resume));
    this.ui.onReset(() => this.resetMission());
    this.ui.onExploreCity(() => this.enterCityExploration());
    this.ui.onModalChange((open) => {
      this.appPaused = open || this.ui.isPaused();
      this.input.reset();
      if (!open) this.clock.start();
    });
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

  start(resume = false): void {
    if (this.started || this.startPending) return;
    // Wait for the GLB character before gameplay becomes visible so the
    // procedural fallback never flashes on a normal startup. The promise
    // always settles: a failed load keeps the fallback and only warns.
    this.startPending = true;
    void this.characterReady.then(() => {
      this.startPending = false;
      this.beginSession(resume);
    });
  }

  /**
   * Boot overlay's single first-tap gesture. Unlocks audio synchronously
   * (still inside the user-gesture stack), attempts fullscreen/orientation
   * lock as a best-effort side effect, and starts loading the character —
   * the loading UI stays up until that promise settles either way.
   */
  private handleBootTap(): void {
    if (this.bootStarted) return;
    this.bootStarted = true;
    this.unlockAudioContext();
    void this.attemptImmersivePresentation();
    this.ui.showBootLoading();
    this.characterReady = Promise.all([
      this.loadCharacterVisual(),
      cityAssetCache.preload(CityDistricts.getPreloadUrls()),
      cityAssetCache.preload(Object.values(CITY_MODEL_URLS.roads)),
      cityAssetCache.preload(Object.values(CITY_MODEL_URLS.sidewalks)),
    ]).then(() => {});
    void this.characterReady.then(() => {
      // this.vehicle (Mission 1's car) was constructed before the cache was
      // warm, so it started with its procedural fallback; swap it now.
      this.vehicle.trySwapToRealModel();
      this.world.buildRoadNetwork();
      this.world.buildSidewalks();
      this.ui.completeBootLoading();
    });
  }

  /**
   * Fullscreen and orientation-lock are optional enhancements only; iOS
   * Safari commonly lacks or rejects both. Every failure is swallowed here
   * so the boot flow never depends on or blocks on either succeeding.
   */
  private async attemptImmersivePresentation(): Promise<void> {
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // Ignored — the rotate/landscape prompt covers this case instead.
    }
    const orientation = screen.orientation as
      | (ScreenOrientation & { lock?: (orientation: string) => Promise<void> })
      | undefined;
    if (document.fullscreenElement && orientation?.lock) {
      try {
        await orientation.lock('landscape');
      } catch {
        // Ignored — unsupported on iOS Safari; the rotate prompt covers it.
      }
    }
  }

  private async loadCharacterVisual(): Promise<void> {
    const definition = assetRegistry.get('character.mohammed');
    if (!definition.url) return;
    try {
      const character = await MohammedGlbCharacter.load(definition.url);
      this.glbCharacter = character;
      this.player.view.setCharacter(character);
      this.characterMetrics = this.player.view.getRenderMetrics();
    } catch (error) {
      console.warn('[GameApp] Mohammed GLB failed to load; keeping the procedural fallback', error);
    }
  }

  private beginSession(resume: boolean): void {
    if (this.started) return;
    this.started = true;
    this.freeRoam = false;
    this.appPaused = false;
    const progress = resume ? this.missionDirector.resume() : this.missionDirector.startNew();
    this.vehicle.reset();
    this.player.teleport(this.world.getSpawnForProgress(progress), Math.PI);
    this.player.view.root.visible = true;
    this.cameraRig.distance = this.mobileAware(5.5, MOBILE_OUTDOOR_DISTANCE);
    this.cameraRig.mode = 'indoor';
    this.cameraRig.reset(Math.PI);
    this.input.reset();
    this.ui.startGame();
    this.syncMissionUI();
    if (progress.completed) {
      this.canvas.focus({ preventScroll: true });
      this.unlockAudioContext();
      this.enterCityExploration();
      return;
    }
    this.clock.start();
    this.canvas.focus({ preventScroll: true });
    this.unlockAudioContext();
    this.ui.showStatus(resume ? 'رجعنا لآخر هدف محفوظ' : 'دور على طريقة تفتح باب المستودع');
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
    this.world.update(delta).forEach((event) => {
      this.handleMissionFeedback(this.missionDirector.handleWorldEvent(event));
    });
    this.vehicles.forEach((vehicle) => vehicle.update(delta, input));
    const occupiedVehicle = this.getOccupiedVehicle();

    if (occupiedVehicle) {
      this.ui.setInteractionPrompt(null);
      this.ui.setVehicleAction('اخرج');
      if (input.vehiclePressed) this.tryExitVehicle();
    } else {
      this.player.update(delta, input, this.cameraRig.yaw);
      const interaction = this.freeRoam
        ? this.updateFreeRoamInteraction()
        : this.missionDirector.updateInteraction(this.player.position, this.player.yaw);
      this.ui.setInteractionPrompt(interaction?.label ?? null);
      if (input.interactPressed) {
        if (this.freeRoam) {
          this.interactInFreeRoam();
        } else {
          const feedback = this.missionDirector.interact();
          if (feedback.changed && interaction?.id === 'door-control') {
            this.player.view.playGesture('openDoor');
          }
          this.handleMissionFeedback(feedback);
        }
      }

      this.nearbyVehicle = this.vehicles.find((vehicle) => {
        const allowed = this.freeRoam
          ? this.storyDirector.canUseVehicle(vehicle.id)
          : vehicle === this.vehicle && this.missionDirector.canUseVehicle();
        return allowed && vehicle.canEnter(this.player.position);
      }) ?? null;
      this.ui.setVehicleAction(this.nearbyVehicle ? `اركب ${this.nearbyVehicle.displayName}` : null);
      if (input.vehiclePressed && this.nearbyVehicle) this.enterVehicle(this.nearbyVehicle);
    }

    const activeVehicle = this.getOccupiedVehicle();
    const navigationPosition = activeVehicle?.position ?? this.player.position;
    const cityUpdate = this.world.updateCityStreaming(delta, navigationPosition, this.player.position);
    if (this.freeRoam && cityUpdate.enteredLocation) {
      this.ui.showStatus(`وصلت: ${cityUpdate.enteredLocation}`);
    }
    if (!this.freeRoam) {
      this.handleMissionFeedback(this.missionDirector.updateZones(navigationPosition, Boolean(activeVehicle)));
    } else {
      this.handleStoryFeedback(this.storyDirector.updateZones(
        delta,
        navigationPosition,
        Boolean(activeVehicle),
        activeVehicle?.id ?? null,
      ));
      this.syncStoryVehicleAvailability();
      this.syncStoryUI();
      const target = this.storyDirector.getTargetPosition();
      this.ui.updateMap(navigationPosition.x, navigationPosition.z, target?.x, target?.z);
      if (!activeVehicle) {
        const indoor = this.world.city.isInsideInterior(this.player.position)
          || this.isInsideOldHouse(this.player.position);
        this.cameraRig.mode = indoor ? 'indoor' : 'outdoor';
        this.cameraRig.distance = indoor
          ? this.mobileAware(4.15, MOBILE_INDOOR_DISTANCE)
          : this.mobileAware(5.5, MOBILE_OUTDOOR_DISTANCE);
      }
    }
    this.getCameraFollowTarget();
    this.cameraRig.update(delta, this.cameraFollowTarget, input.cameraDelta);
    this.renderer.render(this.world.scene, this.cameraRig.camera);
    this.updateDebug(delta);
  }

  private renderOnce(): void {
    this.getCameraFollowTarget();
    this.cameraRig.update(1 / 60, this.cameraFollowTarget, this.zeroCameraDelta);
    this.renderer.render(this.world.scene, this.cameraRig.camera);
  }

  private resize(): void {
    const viewport = window.visualViewport;
    const width = Math.max(1, Math.round(viewport?.width ?? window.innerWidth));
    const height = Math.max(1, Math.round(viewport?.height ?? window.innerHeight));
    this.isMobileViewport = Math.min(width, height) <= MOBILE_VIEWPORT_MAX_DIMENSION;
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.cameraRig.resize(width, height);
  }

  /** Desktop distance is returned unchanged; only phone-sized viewports get the closer value. */
  private mobileAware(desktopDistance: number, mobileDistance: number): number {
    return this.isMobileViewport ? mobileDistance : desktopDistance;
  }

  private installLifecycleHandlers(): void {
    window.addEventListener('resize', () => this.resize(), { passive: true });
    window.addEventListener('orientationchange', () => this.resize(), { passive: true });
    window.visualViewport?.addEventListener('resize', () => this.resize(), { passive: true });
    document.addEventListener('visibilitychange', () => {
      this.appPaused = document.hidden
        || this.ui.isPaused()
        || (this.missionRuntime.getProgress().completed && !this.freeRoam);
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
      `Camera distance: ${this.cameraRig.getResolvedDistance().toFixed(3)}`,
      `Mission: ${this.missionRuntime.getCurrentObjective()?.id ?? 'complete'}`,
      `Sequence: ${this.missionRuntime.getProgress().sequenceIndex}`,
      `Vehicle: ${this.getOccupiedVehicle()?.id ?? 'on-foot'}`,
      `Story: ${this.storyRuntime.getCurrentMission()?.id ?? (this.storyRuntime.getProgress().completed ? 'complete' : 'locked')}`,
      `Grounded: ${this.player.grounded}`,
      `Pose: ${this.player.view.getPoseName()}`,
      `Character calls: ${this.characterMetrics.drawCalls}`,
      `Character tris: ${Math.round(this.characterMetrics.triangles).toLocaleString('en')}`,
      `1% low: ${onePercentLow.toFixed(0)}`,
      `Draw calls: ${info.render.calls}`,
      `Triangles: ${info.render.triangles.toLocaleString('en')}`,
      `Textures: ${info.memory.textures}`,
      `NPCs: ${this.world.getActiveNPCCount()}`,
      `Zones: ${this.world.getActiveCityZoneIds().join(' / ') || 'base only'}`,
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
          playerControlEnabled: this.player.isControlEnabled(),
          playerVisible: this.player.view.root.visible,
          playerOverlappingCollider: this.world.collisions.overlapsCapsule(
            this.player.position,
            this.player.standingShape,
          ),
          player: { x: this.player.position.x, y: this.player.position.y, z: this.player.position.z },
          playerRootY: this.player.view.root.position.y,
          visualLocalY: this.player.view.visualRoot.position.y,
          cameraTargetY: this.debugCameraTarget.y,
          cameraDistance: this.cameraRig.getResolvedDistance(),
          missionObjective: this.missionRuntime.getCurrentObjective()?.id ?? null,
          missionSequence: this.missionRuntime.getProgress().sequenceIndex,
          missionCompleted: this.missionRuntime.getProgress().completed,
          generatorOn: this.world.isGeneratorOn(),
          doorOpen: this.world.isDoorOpen(),
          vehicleOccupied: Boolean(this.getOccupiedVehicle()),
          vehicleSpeed: this.vehicle.speed,
          vehicle: { x: this.vehicle.position.x, y: this.vehicle.position.y, z: this.vehicle.position.z },
          characterPose: this.player.view.getPoseName(),
          characterClip: this.glbCharacter?.getActiveClipName() ?? null,
          characterDrawCalls: this.characterMetrics.drawCalls,
          characterTriangles: this.characterMetrics.triangles,
          drawCalls: this.renderer.info.render.calls,
          triangles: this.renderer.info.render.triangles,
          freeRoam: this.freeRoam,
          cityLocation: this.world.city.getLocationLabel(
            this.vehicle.occupied ? this.vehicle.position : this.player.position,
          ),
          activeZones: this.world.getActiveCityZoneIds(),
          zoneStates: this.world.getCityZoneStates(),
          activeNPCs: this.world.getActiveNPCCount(),
          insideInterior: this.world.city.isInsideInterior(this.player.position),
          activeVehicleId: this.getOccupiedVehicle()?.id ?? null,
          storyMission: this.storyRuntime.getCurrentMission()?.id ?? null,
          storyObjective: this.storyRuntime.getCurrentObjective()?.id ?? null,
          storySequence: this.storyRuntime.getProgress().sequenceIndex,
          storyCompleted: this.storyRuntime.getProgress().completed,
        };
      },
      teleportPlayer: (x, y, z, yaw = this.player.yaw) => {
        this.getOccupiedVehicle()?.exit();
        this.player.teleport(new Vector3(x, y, z), yaw);
        this.player.view.root.visible = true;
        this.cameraRig.distance = this.mobileAware(5.5, MOBILE_OUTDOOR_DISTANCE);
        this.cameraRig.reset(this.cameraRig.yaw);
      },
      teleportActiveVehicle: (x, z, yaw) => {
        const vehicle = this.getOccupiedVehicle();
        if (!vehicle) return;
        vehicle.teleport(new Vector3(x, 0, z), yaw ?? vehicle.yaw);
        this.cameraRig.reset(vehicle.yaw + Math.PI);
      },
      setCameraYaw: (yaw) => { this.cameraRig.reset(yaw); },
      playGesture: (name) => this.player.view.playGesture(name as CharacterGestureName),
      resetMission: () => this.resetMission(),
      enterCity: () => this.enterCityExploration(),
    };
  }

  private getCameraFollowTarget(): Vector3 {
    const occupiedVehicle = this.getOccupiedVehicle();
    return occupiedVehicle
      ? occupiedVehicle.getCameraTarget(this.cameraFollowTarget)
      : this.cameraFollowTarget.copy(this.player.position);
  }

  private enterVehicle(vehicle: SimpleVehicleController): void {
    vehicle.enter();
    this.player.suspendForVehicle();
    this.player.view.root.visible = false;
    this.cameraRig.mode = 'vehicle';
    this.cameraRig.distance = this.mobileAware(
      vehicle.kind === 'bicycle' ? 5.8 : 7,
      (vehicle.kind === 'bicycle' ? 5.8 : 7) * MOBILE_VEHICLE_DISTANCE_SCALE,
    );
    this.cameraRig.reset(vehicle.yaw + Math.PI);
    if (this.freeRoam) this.handleStoryFeedback(this.storyDirector.vehicleEntered(vehicle.id));
    else this.handleMissionFeedback(this.missionDirector.vehicleEntered());
    this.ui.setVehicleAction('اخرج');
  }

  private tryExitVehicle(): void {
    const vehicle = this.getOccupiedVehicle();
    if (!vehicle) return;
    const exit = vehicle.findSafeExit(this.player.standingShape);
    if (!exit) {
      this.ui.showStatus('ما فيه مساحة آمنة للخروج هنا');
      return;
    }
    const exitYaw = vehicle.yaw + Math.PI;
    vehicle.exit();
    this.player.resumeAfterVehicleExit(exit, exitYaw);
    this.player.view.root.visible = true;
    this.cameraRig.mode = 'outdoor';
    this.cameraRig.distance = this.mobileAware(5.5, MOBILE_OUTDOOR_DISTANCE);
    this.cameraRig.reset(this.cameraRig.yaw);
    this.ui.setVehicleAction(null);
  }

  private handleMissionFeedback(feedback: MissionFeedback): void {
    if (!feedback.changed) return;
    if (feedback.message) this.ui.showStatus(feedback.message);
    this.syncMissionUI();
    if (!feedback.completed) return;
    this.appPaused = true;
    this.ui.showMissionComplete();
  }

  private syncMissionUI(): void {
    this.ui.updateMission(MISSION_ONE.title, this.missionDirector.getObjectiveText());
    this.ui.setContinueAvailable(this.missionRuntime.hasSavedProgress());
  }

  private resetMission(): void {
    this.freeRoam = false;
    this.activeCityInteraction = null;
    this.interactionSource = null;
    this.storyDirector.reset();
    const progress = this.missionDirector.reset();
    this.vehicles.forEach((vehicle, index) => {
      vehicle.reset();
      if (index > 0) vehicle.setAvailable(false);
    });
    this.player.teleport(this.world.getSpawnForProgress(progress), Math.PI);
    this.player.view.root.visible = true;
    this.cameraRig.mode = 'indoor';
    this.cameraRig.distance = this.mobileAware(5.5, MOBILE_OUTDOOR_DISTANCE);
    this.cameraRig.reset(Math.PI);
    this.input.reset();
    this.appPaused = false;
    this.started = true;
    this.ui.startGame();
    this.ui.setInteractionPrompt(null);
    this.ui.setVehicleAction(null);
    this.syncMissionUI();
    this.clock.start();
    this.ui.showStatus('رجعت المهمة من البداية');
  }

  private enterCityExploration(): void {
    if (!this.started || !this.missionRuntime.getProgress().completed) return;
    this.getOccupiedVehicle()?.exit();
    this.ensureStoryVehicles();
    this.storyDirector.startOrResume();
    this.syncStoryVehicleAvailability();
    this.freeRoam = true;
    this.appPaused = false;
    this.activeCityInteraction = null;
    const cityEntryYaw = -Math.PI / 2;
    this.player.teleport(this.world.city.cityStartPoint, cityEntryYaw);
    this.player.view.root.visible = true;
    this.cameraRig.mode = 'outdoor';
    this.cameraRig.distance = this.mobileAware(5.5, MOBILE_OUTDOOR_DISTANCE);
    this.cameraRig.reset(cityEntryYaw);
    this.input.reset();
    this.ui.enterCityExploration();
    this.ui.setInteractionPrompt(null);
    this.ui.setVehicleAction(null);
    this.syncStoryUI();
    this.ui.showStatus('المرحلة الرابعة بدأت — توجه لصديق محمد');
    this.clock.start();
  }

  private updateFreeRoamInteraction(): InteractableDefinition | null {
    const storyInteraction = this.storyDirector.updateInteraction(this.player.position, this.player.yaw);
    this.activeStoryInteractionId = storyInteraction?.id ?? null;
    if (storyInteraction) {
      this.interactionSource = 'story';
      this.activeCityInteraction = null;
      return storyInteraction;
    }
    this.activeCityInteraction = this.interactionSystem.findBest(
      this.player.position,
      this.player.yaw,
      this.world.city.getInteractables(),
    );
    this.interactionSource = this.activeCityInteraction ? 'city' : null;
    return this.activeCityInteraction;
  }

  private interactInFreeRoam(): void {
    if (this.interactionSource === 'story') {
      const interactionId = this.activeStoryInteractionId;
      const feedback = this.storyDirector.interact();
      if (feedback.changed && interactionId) {
        this.player.view.playGesture(storyGestureFor(interactionId));
      }
      this.handleStoryFeedback(feedback);
      return;
    }
    if (this.interactionSource === 'city' && this.activeCityInteraction) {
      const message = this.world.city.interact(this.activeCityInteraction.id);
      if (message) {
        // Every streamed city interactable is a hinged door leaf.
        this.player.view.playGesture('openDoor');
        this.ui.showStatus(message);
      }
    }
  }

  private handleStoryFeedback(feedback: StoryFeedback): void {
    if (!feedback.changed) return;
    if (feedback.message) this.ui.showStatus(feedback.message);
    this.syncStoryVehicleAvailability();
    this.syncStoryUI();
    if (feedback.dialogue) {
      this.ui.showDialogue(feedback.dialogue.speaker, feedback.dialogue.lines, () => {
        this.appPaused = false;
        this.clock.start();
      });
    }
    if (feedback.storyCompleted) {
      this.ui.showStatus('اكتملت مهمات المرحلة الرابعة — كفو يا محمد!');
    }
  }

  private syncStoryUI(): void {
    const mission = this.storyRuntime.getCurrentMission();
    if (!mission) {
      this.ui.updateMission('المرحلة الرابعة', 'اكتملت المهمات 2 إلى 5', '✓');
      return;
    }
    this.ui.updateMission(
      mission.title,
      this.storyDirector.getObjectiveText(),
      String(mission.number).padStart(2, '0'),
    );
  }

  private ensureStoryVehicles(): void {
    if (this.storyVehiclesInitialized) return;
    this.storyVehiclesInitialized = true;
    const bicycle = new SimpleVehicleController(this.world.collisions, new Vector3(15, 0, 36), -Math.PI / 2, {
      id: 'bicycle',
      displayName: 'الدراجة',
      kind: 'bicycle',
      size: new Vector3(1.05, 1.4, 2.15),
      shape: { radius: 0.62, height: 1.4 },
      paint: 0x2c8588,
      maxForwardSpeed: 5.6,
      maxReverseSpeed: 1.8,
      steeringRate: 2.05,
      cameraHeight: 0.72,
    });
    const sport = new SimpleVehicleController(this.world.collisions, new Vector3(8, 0, 29), Math.PI / 2, {
      id: 'sport-car',
      displayName: 'السيارة الرياضية',
      kind: 'sport',
      paint: 0x2f8391,
      maxForwardSpeed: 10.5,
      maxReverseSpeed: 3.6,
      steeringRate: 1.85,
    });
    const classic = new SimpleVehicleController(this.world.collisions, new Vector3(-11, 0, 29), -Math.PI / 2, {
      id: 'classic-car',
      displayName: 'السيارة القديمة',
      kind: 'classic',
      paint: 0xd0a044,
      maxForwardSpeed: 7.8,
      maxReverseSpeed: 3,
      steeringRate: 1.55,
    });
    for (const vehicle of [bicycle, sport, classic]) {
      this.vehicles.push(vehicle);
      this.world.scene.add(vehicle.root);
      vehicle.setAvailable(false);
      // ensureStoryVehicles() only ever runs once free-roam is reachable,
      // which is always after the boot overlay's asset preload settles, so
      // the cache is already warm and this swap is effectively immediate.
      vehicle.trySwapToRealModel();
    }
  }

  private syncStoryVehicleAvailability(): void {
    this.vehicles.slice(1).forEach((vehicle) => {
      vehicle.setAvailable(this.storyDirector.canUseVehicle(vehicle.id));
    });
  }

  private getOccupiedVehicle(): SimpleVehicleController | null {
    return this.vehicles.find((vehicle) => vehicle.occupied) ?? null;
  }

  private isInsideOldHouse(position: Vector3): boolean {
    return position.x > -53.7 && position.x < -40.2
      && position.z > 10.3 && position.z < 21.7;
  }
}
