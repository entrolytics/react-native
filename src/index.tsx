import { Platform, AppState, AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface EntrolyticsConfig {
  endpoint: string;
  apiKey: string;
  websiteId: string;
  debug?: boolean;
  enableOfflineTracking?: boolean;
  maxOfflineEvents?: number;
}

export interface Event {
  event: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
}

export interface ScreenEvent {
  screenName: string;
  properties?: Record<string, unknown>;
}

const VISITOR_ID_STORAGE_KEY = "@entrolytics:visitor_id";
const OFFLINE_QUEUE_STORAGE_KEY = "@entrolytics:offline_queue";

function isEvent(value: unknown): value is Event {
  if (typeof value !== "object" || value === null || !("event" in value)) {
    return false;
  }
  if (typeof value.event !== "string") {
    return false;
  }
  if (
    "timestamp" in value &&
    value.timestamp !== undefined &&
    typeof value.timestamp !== "string"
  ) {
    return false;
  }
  return (
    !("properties" in value) ||
    value.properties === undefined ||
    (typeof value.properties === "object" &&
      value.properties !== null &&
      !Array.isArray(value.properties))
  );
}

const createUuid = (): string =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });

class EntrolyticsReactNative {
  private config?: EntrolyticsConfig;
  private initialized = false;
  private offlineQueue: Event[] = [];
  private appStateSubscription?: ReturnType<typeof AppState.addEventListener>;
  private visitorId?: string;
  private visitorDay?: string;
  private sessionId = createUuid();

  async initialize(config: EntrolyticsConfig): Promise<void> {
    this.config = config;
    this.initialized = true;

    if (config.debug) {
      console.log("[Entrolytics] Initialized with config:", config);
    }

    // Load offline queue
    if (config.enableOfflineTracking) {
      await this.loadOfflineQueue();
      await this.flushOfflineQueue();
    }

    // Track app state changes
    this.appStateSubscription = AppState.addEventListener(
      "change",
      this.handleAppStateChange.bind(this),
    );

    // Track app open
    await this.track({
      event: "app_open",
      properties: {
        platform: Platform.OS,
        version: Platform.Version,
      },
    });
  }

  async track(event: Event): Promise<void> {
    if (!this.initialized || !this.config) {
      throw new Error("Entrolytics not initialized. Call initialize() first.");
    }

    const visitorId = await this.getVisitorId();

    const payload = {
      websiteId: this.config.websiteId,
      eventId: createUuid(),
      sessionId: this.sessionId,
      visitorId,
      url: `app://react-native/${event.event}`,
      eventType: event.event === "screen_view" ? "pageview" : "custom_event",
      eventName: event.event,
      timestamp: event.timestamp || new Date().toISOString(),
      properties: {
        ...event.properties,
        platform: Platform.OS,
        app_state: AppState.currentState,
      },
    };

    if (this.config.debug) {
      console.log("[Entrolytics] Tracking event:", payload);
    }

    try {
      const response = await fetch(`${this.config.endpoint}/collect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.config.apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok && this.config.debug) {
        console.error("[Entrolytics] Tracking failed:", response.status);
      }
    } catch (error) {
      if (this.config.debug) {
        console.error("[Entrolytics] Tracking error:", error);
      }

      // Queue for offline tracking
      if (this.config.enableOfflineTracking) {
        await this.queueOfflineEvent(event);
      }
    }
  }

  async trackScreen(screenName: string, properties?: Record<string, unknown>): Promise<void> {
    await this.track({
      event: "screen_view",
      properties: {
        screen_name: screenName,
        ...properties,
      },
    });
  }

  async identify(userId: string, traits?: Record<string, unknown>): Promise<void> {
    await this.track({
      event: "identify",
      properties: {
        userId,
        ...traits,
      },
    });
  }

  private async handleAppStateChange(nextAppState: AppStateStatus): Promise<void> {
    if (nextAppState === "active") {
      await this.track({
        event: "app_foreground",
        properties: {
          platform: Platform.OS,
        },
      });

      // Flush offline queue when app comes to foreground
      if (this.config?.enableOfflineTracking) {
        await this.flushOfflineQueue();
      }
    } else if (nextAppState === "background") {
      await this.track({
        event: "app_background",
        properties: {
          platform: Platform.OS,
        },
      });
    }
  }

  private async queueOfflineEvent(event: Event): Promise<void> {
    const maxEvents = this.config?.maxOfflineEvents || 100;
    this.offlineQueue.push(event);

    // Keep only the most recent events
    if (this.offlineQueue.length > maxEvents) {
      this.offlineQueue = this.offlineQueue.slice(-maxEvents);
    }

    await this.saveOfflineQueue();
  }

  private async loadOfflineQueue(): Promise<void> {
    try {
      const queueJson = await AsyncStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
      if (queueJson) {
        const parsed: unknown = JSON.parse(queueJson);
        this.offlineQueue = Array.isArray(parsed) ? parsed.filter(isEvent) : [];
      }
    } catch (error) {
      if (this.config?.debug) {
        console.error("[Entrolytics] Failed to load offline queue:", error);
      }
    }
  }

  private async saveOfflineQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(this.offlineQueue));
    } catch (error) {
      if (this.config?.debug) {
        console.error("[Entrolytics] Failed to save offline queue:", error);
      }
    }
  }

  private async flushOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) {
      return;
    }

    const events = [...this.offlineQueue];
    this.offlineQueue = [];
    await this.saveOfflineQueue();

    for (const event of events) {
      try {
        await this.track(event);
      } catch {
        // Re-queue failed events
        await this.queueOfflineEvent(event);
      }
    }
  }

  destroy(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    this.initialized = false;
  }

  private async getVisitorId(): Promise<string> {
    const visitorDay = new Date().toISOString().slice(0, 10);
    if (this.visitorId && this.visitorDay === visitorDay) {
      return this.visitorId;
    }

    const storedVisitor = await AsyncStorage.getItem(VISITOR_ID_STORAGE_KEY);
    if (storedVisitor) {
      try {
        const parsed: unknown = JSON.parse(storedVisitor);
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          "day" in parsed &&
          parsed.day === visitorDay &&
          "id" in parsed &&
          typeof parsed.id === "string"
        ) {
          this.visitorDay = visitorDay;
          this.visitorId = parsed.id;
          return parsed.id;
        }
      } catch {
        // Replace malformed or legacy values with the current daily identity.
      }
    }

    const newId = createUuid();
    this.visitorDay = visitorDay;
    this.visitorId = newId;
    await AsyncStorage.setItem(
      VISITOR_ID_STORAGE_KEY,
      JSON.stringify({ day: visitorDay, id: newId }),
    );
    return newId;
  }
}

export const Entrolytics = new EntrolyticsReactNative();

export default Entrolytics;
