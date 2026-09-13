import type { ComponentType } from "react";
import type { NotificationStatus } from "@/store/useNotificationManager";
import {
  EmbeddingBackfillCard,
  type BackfillToastItem,
} from "@/components/Notifications/EmbeddingBackfillToast";
import {
  ReviewReminderCard,
  type ReviewReminderItem,
} from "@/components/Notifications/ReviewReminderToast";
import {
  DeadlineReminderCard,
  type DeadlineReminderItem,
} from "@/components/Notifications/DeadlineReminderToast";
import {
  LevelTestNotification,
  type LevelTestNotice,
} from "@/components/Learning/LevelTestNotification";
import { RelationDiscoveryNotification } from "@/components/GraphEditor/RelationDiscoveryNotification";
import type { RelationDiscoveryNotice } from "@/store/useRelationDiscoveryNotificationStore";
import { AutoClassifyNotification } from "@/components/GraphMap/AutoClassifyNotification";
import type { AutoClassifyNotice } from "@/store/useAutoClassifyNotificationStore";
import { GoalDialogVariantNotification } from "@/components/GraphMap/GoalDialogVariantNotification";
import type { GoalDialogVariantNotice } from "@/store/useGoalDialogVariantNotificationStore";
import { GraphExpansionNotification } from "@/components/GraphMap/GraphExpansionNotification";
import type { GraphExpansionNotice } from "@/store/useGraphExpansionNotificationStore";

export interface NotificationRendererProps {
  data: unknown;
  status: NotificationStatus;
  onDismiss: () => void;
  onAction?: () => void;
}

export type NotificationRenderer = ComponentType<NotificationRendererProps>;

export const notificationRenderers: Record<string, NotificationRenderer> = {
  "embedding-backfill": ({ data, onDismiss }) => (
    <EmbeddingBackfillCard item={data as BackfillToastItem} onDismiss={onDismiss} />
  ),
  "review-reminder": ({ data, onDismiss, onAction }) => (
    <ReviewReminderCard
      item={data as ReviewReminderItem}
      onDismiss={onDismiss}
      onReview={onAction ?? (() => {})}
    />
  ),
  "deadline-reminder": ({ data, onDismiss, onAction }) => (
    <DeadlineReminderCard
      item={data as DeadlineReminderItem}
      onDismiss={onDismiss}
      onViewTask={onAction ?? (() => {})}
    />
  ),
  "level-test": ({ data, onDismiss, onAction }) => (
    <LevelTestNotification
      notice={data as LevelTestNotice}
      onClose={onDismiss}
      onStart={onAction ?? (() => {})}
    />
  ),
  "relation-discovery": ({ data, onDismiss, onAction }) => (
    <RelationDiscoveryNotification
      notice={data as RelationDiscoveryNotice}
      onClose={onDismiss}
      onContinue={onAction ?? (() => {})}
    />
  ),
  "auto-classify": ({ data, onDismiss, onAction }) => (
    <AutoClassifyNotification
      notice={data as AutoClassifyNotice}
      onClose={onDismiss}
      onContinue={onAction ?? (() => {})}
    />
  ),
  "goal-variant": ({ data, onDismiss, onAction }) => (
    <GoalDialogVariantNotification
      notice={data as GoalDialogVariantNotice}
      onClose={onDismiss}
      onContinue={onAction ?? (() => {})}
    />
  ),
  "graph-expansion": ({ data, onDismiss, onAction }) => (
    <GraphExpansionNotification
      notice={data as GraphExpansionNotice}
      onClose={onDismiss}
      onContinue={onAction ?? (() => {})}
    />
  ),
};
