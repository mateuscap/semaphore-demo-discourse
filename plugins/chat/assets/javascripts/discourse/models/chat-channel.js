import UserChatChannelMembership from "discourse/plugins/chat/discourse/models/user-chat-channel-membership";
import ChatMessage from "discourse/plugins/chat/discourse/models/chat-message";
import { escapeExpression } from "discourse/lib/utilities";
import { tracked } from "@glimmer/tracking";
import slugifyChannel from "discourse/plugins/chat/discourse/lib/slugify-channel";
import ChatThreadsManager from "discourse/plugins/chat/discourse/lib/chat-threads-manager";
import ChatMessagesManager from "discourse/plugins/chat/discourse/lib/chat-messages-manager";
import { getOwner } from "discourse-common/lib/get-owner";
import guid from "pretty-text/guid";
import ChatThread from "discourse/plugins/chat/discourse/models/chat-thread";
import ChatDirectMessage from "discourse/plugins/chat/discourse/models/chat-direct-message";
import ChatChannelArchive from "discourse/plugins/chat/discourse/models/chat-channel-archive";
import Category from "discourse/models/category";
import ChatTrackingState from "discourse/plugins/chat/discourse/models/chat-tracking-state";

export const CHATABLE_TYPES = {
  directMessageChannel: "DirectMessage",
  categoryChannel: "Category",
};

export const CHANNEL_STATUSES = {
  open: "open",
  readOnly: "read_only",
  closed: "closed",
  archived: "archived",
};

export function channelStatusIcon(channelStatus) {
  if (channelStatus === CHANNEL_STATUSES.open) {
    return null;
  }

  switch (channelStatus) {
    case CHANNEL_STATUSES.closed:
      return "lock";
    case CHANNEL_STATUSES.readOnly:
      return "comment-slash";
    case CHANNEL_STATUSES.archived:
      return "archive";
  }
}

const STAFF_READONLY_STATUSES = [
  CHANNEL_STATUSES.readOnly,
  CHANNEL_STATUSES.archived,
];

const READONLY_STATUSES = [
  CHANNEL_STATUSES.closed,
  CHANNEL_STATUSES.readOnly,
  CHANNEL_STATUSES.archived,
];

export default class ChatChannel {
  static create(args = {}) {
    return new ChatChannel(args);
  }

  @tracked title;
  @tracked slug;
  @tracked description;
  @tracked status;
  @tracked activeThread = null;
  @tracked canDeleteOthers;
  @tracked canDeleteSelf;
  @tracked canFlag;
  @tracked canModerate;
  @tracked userSilenced;
  @tracked meta;
  @tracked chatableType;
  @tracked chatableUrl;
  @tracked autoJoinUsers = false;
  @tracked allowChannelWideMentions = true;
  @tracked membershipsCount = 0;
  @tracked archive;
  @tracked tracking;
  @tracked threadingEnabled = false;

  threadsManager = new ChatThreadsManager(getOwner(this));
  messagesManager = new ChatMessagesManager(getOwner(this));

  @tracked _currentUserMembership;
  @tracked _lastMessage;

  constructor(args = {}) {
    this.id = args.id;
    this.chatableId = args.chatable_id;
    this.chatableUrl = args.chatable_url;
    this.chatableType = args.chatable_type;
    this.membershipsCount = args.memberships_count;
    this.meta = args.meta;
    this.slug = args.slug;
    this.title = args.title;
    this.status = args.status;
    this.canDeleteSelf = args.can_delete_self;
    this.canDeleteOthers = args.can_delete_others;
    this.canFlag = args.can_flag;
    this.userSilenced = args.user_silenced;
    this.canModerate = args.can_moderate;
    this.description = args.description;
    this.threadingEnabled = args.threading_enabled;
    this.autoJoinUsers = args.auto_join_users;
    this.allowChannelWideMentions = args.allow_channel_wide_mentions;
    this.chatable = this.isDirectMessageChannel
      ? ChatDirectMessage.create({
          id: args.chatable?.id,
          users: args.chatable?.users,
        })
      : Category.create(args.chatable);
    this.currentUserMembership = args.current_user_membership;

    if (args.archive_completed || args.archive_failed) {
      this.archive = ChatChannelArchive.create(args);
    }

    this.tracking = new ChatTrackingState(getOwner(this));
    this.lastMessage = args.last_message;
  }

  get unreadThreadsCountSinceLastViewed() {
    return Array.from(this.threadsManager.unreadThreadOverview.values()).filter(
      (lastReplyCreatedAt) =>
        lastReplyCreatedAt >= this.currentUserMembership.lastViewedAt
    ).length;
  }

  updateLastViewedAt() {
    this.currentUserMembership.lastViewedAt = new Date();
  }

  findIndexOfMessage(id) {
    return this.messagesManager.findIndexOfMessage(id);
  }

  findStagedMessage(id) {
    return this.messagesManager.findStagedMessage(id);
  }

  findMessage(id) {
    return this.messagesManager.findMessage(id);
  }

  findFirstMessageOfDay(date) {
    return this.messagesManager.findFirstMessageOfDay(date);
  }

  addMessages(messages) {
    this.messagesManager.addMessages(messages);
  }

  clearMessages() {
    this.messagesManager.clearMessages();
  }

  removeMessage(message) {
    this.messagesManager.removeMessage(message);
  }

  lastUserMessage(user) {
    return this.messagesManager.findLastUserMessage(user);
  }

  get messages() {
    return this.messagesManager.messages;
  }

  set messages(messages) {
    this.messagesManager.messages = messages;
  }

  get canLoadMoreFuture() {
    return this.messagesManager.canLoadMoreFuture;
  }

  get canLoadMorePast() {
    return this.messagesManager.canLoadMorePast;
  }

  get escapedTitle() {
    return escapeExpression(this.title);
  }

  get escapedDescription() {
    return escapeExpression(this.description);
  }

  get slugifiedTitle() {
    return this.slug || slugifyChannel(this);
  }

  get routeModels() {
    return [this.slugifiedTitle, this.id];
  }

  get selectedMessages() {
    return this.messages.filter((message) => message.selected);
  }

  get isDirectMessageChannel() {
    return this.chatableType === CHATABLE_TYPES.directMessageChannel;
  }

  get isCategoryChannel() {
    return this.chatableType === CHATABLE_TYPES.categoryChannel;
  }

  get isOpen() {
    return !this.status || this.status === CHANNEL_STATUSES.open;
  }

  get isReadOnly() {
    return this.status === CHANNEL_STATUSES.readOnly;
  }

  get isClosed() {
    return this.status === CHANNEL_STATUSES.closed;
  }

  get isArchived() {
    return this.status === CHANNEL_STATUSES.archived;
  }

  get isJoinable() {
    return this.isOpen && !this.isArchived;
  }

  get isFollowing() {
    return this.currentUserMembership.following;
  }

  get canJoin() {
    return this.meta.can_join_chat_channel;
  }

  get visibleMessages() {
    return this.messages.filter((message) => message.visible);
  }

  set details(details) {
    this.canDeleteOthers = details.can_delete_others ?? false;
    this.canDeleteSelf = details.can_delete_self ?? false;
    this.canFlag = details.can_flag ?? false;
    this.canModerate = details.can_moderate ?? false;
    if (details.can_load_more_future !== undefined) {
      this.messagesManager.canLoadMoreFuture = details.can_load_more_future;
    }
    if (details.can_load_more_past !== undefined) {
      this.messagesManager.canLoadMorePast = details.can_load_more_past;
    }
    this.userSilenced = details.user_silenced ?? false;
    this.status = details.channel_status;
    this.channelMessageBusLastId = details.channel_message_bus_last_id;
  }

  createStagedThread(message) {
    const clonedMessage = message.duplicate();

    const thread = new ChatThread(this, {
      id: `staged-thread-${message.channel.id}-${message.id}`,
      original_message: message,
      staged: true,
      created_at: moment.utc().format(),
    });

    clonedMessage.thread = thread;
    this.threadsManager.add(this, thread);
    thread.messagesManager.addMessages([clonedMessage]);

    return thread;
  }

  async stageMessage(message) {
    message.id = guid();
    message.staged = true;
    message.draft = false;
    message.createdAt ??= moment.utc().format();
    message.channel = this;

    if (message.inReplyTo) {
      if (!this.threadingEnabled) {
        this.addMessages([message]);
      }
    } else {
      this.addMessages([message]);
    }
  }

  canModifyMessages(user) {
    if (user.staff) {
      return !STAFF_READONLY_STATUSES.includes(this.status);
    }

    return !READONLY_STATUSES.includes(this.status);
  }

  get currentUserMembership() {
    return this._currentUserMembership;
  }

  set currentUserMembership(membership) {
    if (membership instanceof UserChatChannelMembership) {
      this._currentUserMembership = membership;
    } else {
      this._currentUserMembership =
        UserChatChannelMembership.create(membership);
    }
  }

  get lastMessage() {
    return this._lastMessage;
  }

  set lastMessage(message) {
    if (!message) {
      this._lastMessage = null;
      return;
    }

    if (message instanceof ChatMessage) {
      this._lastMessage = message;
    } else {
      this._lastMessage = ChatMessage.create(this, message);
    }
  }

  clearSelectedMessages() {
    this.selectedMessages.forEach((message) => (message.selected = false));
  }
}
