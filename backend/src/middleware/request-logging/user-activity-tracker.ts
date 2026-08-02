import type { CommandBus } from "@/application/common/buses/command.bus";
import { UpdateUserActivityCommand } from "@/application/commands/admin/updateUserActivity/updateUserActivity.command";
import { logger } from "@/utils/winston";
import type { CompletedRequestContext } from "./completed-request-context";

const USER_ACTIVITY_UPDATE_INTERVAL_MS = 5 * 60 * 1000;
const MAX_TRACKED_ACTIVITY_USERS = 10_000;

interface UserActivityReservation {
  ip: string;
  updatedAt: number;
}

export class UserActivityThrottle {
  private readonly users = new Map<string, UserActivityReservation>();

  reserve(
    userId: string,
    ip: string,
    now = Date.now(),
  ): UserActivityReservation | undefined {
    const previous = this.users.get(userId);
    if (
      previous &&
      previous.ip === ip &&
      now - previous.updatedAt < USER_ACTIVITY_UPDATE_INTERVAL_MS
    ) {
      return undefined;
    }

    if (!previous && this.users.size >= MAX_TRACKED_ACTIVITY_USERS) {
      const oldestUserId = this.users.keys().next().value;
      if (oldestUserId) {
        this.users.delete(oldestUserId);
      }
    }

    const reservation = { ip, updatedAt: now };
    this.users.delete(userId);
    this.users.set(userId, reservation);
    return reservation;
  }

  release(userId: string, reservation: UserActivityReservation): void {
    if (this.users.get(userId) === reservation) {
      this.users.delete(userId);
    }
  }
}

export function dispatchUserActivityUpdate(
  commandBus: CommandBus,
  context: CompletedRequestContext,
  activityThrottle: UserActivityThrottle,
): void {
  const userId = context.userId;
  if (!userId) {
    return;
  }

  const reservation = activityThrottle.reserve(userId, context.ip);
  if (!reservation) {
    return;
  }

  const command = new UpdateUserActivityCommand({
    userId,
    ip: context.ip,
  });
  void commandBus.dispatch(command).catch((error) => {
    activityThrottle.release(userId, reservation);
    logger.error("Failed to update user activity", {
      event: "user.activity.update_failed",
      userId,
      correlationId: context.correlationId,
      error,
    });
  });
}
