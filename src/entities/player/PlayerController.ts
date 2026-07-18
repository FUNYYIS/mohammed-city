import { MathUtils, Vector2, Vector3 } from 'three';
import type { InputSnapshot } from '../../controls/InputManager';
import type { CapsuleShape } from '../../physics/CollisionWorld';
import { CollisionWorld } from '../../physics/CollisionWorld';
import { PlayerView } from './PlayerView';

const worldForward = new Vector3();
const worldRight = new Vector3();
const desiredDirection = new Vector3();
const displacement = new Vector3();
const horizontalVelocity = new Vector2();

export class PlayerController {
  readonly position = new Vector3(0, 0, 5.5);
  readonly velocity = new Vector3();
  readonly view = new PlayerView();
  readonly standingShape: CapsuleShape = { radius: 0.4, height: 1.82 };
  readonly crouchingShape: CapsuleShape = { radius: 0.4, height: 1.32 };
  grounded = true;
  crouching = false;
  yaw = 0;
  private currentSpeed = 0;

  constructor(private readonly collisionWorld: CollisionWorld) {
    this.view.root.position.copy(this.position);
  }

  update(delta: number, input: InputSnapshot, cameraYaw: number): void {
    const safeDelta = Math.min(delta, 1 / 20);
    const wasGrounded = this.grounded;
    this.crouching = input.crouch;

    // The camera sits at +offset from its target, so its view direction uses
    // the negative X/Z offset. Keeping this basis identical to the camera
    // prevents touch movement from reversing after orbiting left or right.
    worldForward.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    worldRight.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
    desiredDirection
      .copy(worldForward)
      .multiplyScalar(input.move.y)
      .addScaledVector(worldRight, input.move.x);
    if (desiredDirection.lengthSq() > 1) desiredDirection.normalize();

    const hasMovement = desiredDirection.lengthSq() > 0.001;
    const maxSpeed = this.crouching ? 1.65 : input.run ? 5.5 : 3.2;
    const targetVelocityX = hasMovement ? desiredDirection.x * maxSpeed : 0;
    const targetVelocityZ = hasMovement ? desiredDirection.z * maxSpeed : 0;
    const acceleration = hasMovement ? (this.grounded ? 16 : 5.5) : 20;

    this.velocity.x = MathUtils.damp(this.velocity.x, targetVelocityX, acceleration, safeDelta);
    this.velocity.z = MathUtils.damp(this.velocity.z, targetVelocityZ, acceleration, safeDelta);

    if (hasMovement) {
      // The character visual faces -Z, so rotate its forward direction
      // toward the movement vector without changing controller semantics.
      const targetYaw = Math.atan2(-desiredDirection.x, -desiredDirection.z);
      let angleDelta = MathUtils.euclideanModulo(targetYaw - this.yaw + Math.PI, Math.PI * 2) - Math.PI;
      angleDelta = MathUtils.clamp(angleDelta, -safeDelta * 10, safeDelta * 10);
      this.yaw += angleDelta;
    }

    if (input.jumpPressed && this.grounded && !this.crouching) {
      this.velocity.y = 6.35;
      this.grounded = false;
    }

    if (!this.grounded) this.velocity.y -= 18.5 * safeDelta;
    displacement.copy(this.velocity).multiplyScalar(safeDelta);
    const previousX = this.position.x;
    const previousZ = this.position.z;
    const moveResult = this.collisionWorld.moveCapsuleWithResult(
      this.position,
      displacement,
      this.crouching ? this.crouchingShape : this.standingShape,
    );

    if (Math.abs(this.position.x - previousX) < Math.abs(displacement.x) * 0.2) this.velocity.x = 0;
    if (Math.abs(this.position.z - previousZ) < Math.abs(displacement.z) * 0.2) this.velocity.z = 0;

    if (moveResult.hitCeiling && this.velocity.y > 0) this.velocity.y = 0;
    if (moveResult.hitGround || this.position.y <= 0) {
      if (this.position.y <= 0) this.position.y = 0;
      this.velocity.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }
    const justLanded = !wasGrounded && this.grounded;

    horizontalVelocity.set(this.velocity.x, this.velocity.z);
    this.currentSpeed = horizontalVelocity.length();
    this.view.root.position.copy(this.position);
    this.view.root.rotation.y = this.yaw;
    this.view.update(
      safeDelta,
      Math.min(1, this.currentSpeed / 4.2),
      this.crouching,
      this.grounded,
      justLanded,
      this.velocity.y,
    );
  }

  getSpeed(): number {
    return this.currentSpeed;
  }
}
