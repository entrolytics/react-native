# @entrolytics/react-native

React Native SDK for Entrolytics - First-party growth analytics for the edge.

## Features

- 📱 **Cross-Platform** - Works on iOS and Android
- 🔄 **Offline Support** - Queue events when offline
- 📊 **Automatic Tracking** - App lifecycle events
- 🎯 **Screen Tracking** - Track screen views
- 🛡️ **Type-Safe** - Full TypeScript support
- ⚡ **Lightweight** - Minimal dependencies
- 🐛 **Debug Mode** - Built-in debugging

## Installation

```bash
npm install @entrolytics/react-native @react-native-async-storage/async-storage

# or

yarn add @entrolytics/react-native @react-native-async-storage/async-storage
```

### iOS

```bash
cd ios && pod install
```

## Quick Start

```typescript
import Entrolytics from "@entrolytics/react-native";

// Initialize in your App.tsx
useEffect(() => {
  Entrolytics.initialize({
    endpoint: "https://entrolytics.click",
    apiKey: "your-api-key",
    websiteId: "your-website-id",
    debug: __DEV__,
    enableOfflineTracking: true,
  });
}, []);
```

## Usage

### Track Custom Events

```typescript
import Entrolytics from "@entrolytics/react-native";

// Track button click
const handlePurchase = async () => {
  await Entrolytics.track({
    event: "purchase",
    properties: {
      amount: 99.99,
      product_id: "prod_123",
      currency: "USD",
    },
  });
};
```

### Track Screen Views

```typescript
import { useEffect } from 'react'
import Entrolytics from '@entrolytics/react-native'

function ProfileScreen() {
  useEffect(() => {
    Entrolytics.trackScreen('Profile', {
      user_type: 'premium'
    })
  }, [])

  return <View>...</View>
}
```

### Identify Users

```typescript
import Entrolytics from "@entrolytics/react-native";

const handleLogin = async (user) => {
  await Entrolytics.identify(user.id, {
    email: user.email,
    name: user.name,
    plan: user.plan,
  });
};
```

### React Navigation Integration

```typescript
import { NavigationContainer } from '@react-navigation/native'
import Entrolytics from '@entrolytics/react-native'

function App() {
  const navigationRef = useRef()
  const routeNameRef = useRef()

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        routeNameRef.current = navigationRef.current.getCurrentRoute().name
      }}
      onStateChange={async () => {
        const previousRouteName = routeNameRef.current
        const currentRouteName = navigationRef.current.getCurrentRoute().name

        if (previousRouteName !== currentRouteName) {
          await Entrolytics.trackScreen(currentRouteName)
        }

        routeNameRef.current = currentRouteName
      }}
    >
      {/* Your navigation stack */}
    </NavigationContainer>
  )
}
```

## Configuration

```typescript
interface EntrolyticsConfig {
  endpoint: string; // Your Entrolytics endpoint
  apiKey: string; // Your API key
  websiteId: string; // Your website ID
  debug?: boolean; // Enable debug logging
  enableOfflineTracking?: boolean; // Queue events when offline
  maxOfflineEvents?: number; // Max events to queue (default: 100)
}
```

## Automatic Events

The SDK automatically tracks:

- `app_open` - When app is opened
- `app_foreground` - When app comes to foreground
- `app_background` - When app goes to background

## Offline Tracking

Events are automatically queued when offline and sent when connection is restored:

```typescript
Entrolytics.initialize({
  endpoint: "https://entrolytics.click",
  apiKey: "your-api-key",
  websiteId: "your-website-id",
  enableOfflineTracking: true,
  maxOfflineEvents: 100,
});
```

## API Reference

### `initialize(config: EntrolyticsConfig): Promise<void>`

Initialize the SDK with configuration.

### `track(event: Event): Promise<void>`

Track a custom event.

### `trackScreen(screenName: string, properties?: Record<string, unknown>): Promise<void>`

Track a screen view.

### `identify(userId: string, traits?: Record<string, unknown>): Promise<void>`

Identify a user.

### `destroy(): void`

Clean up resources and event listeners.

## Best Practices

1. **Initialize Early** - Initialize in App.tsx
2. **Use Debug Mode** - Enable in development
3. **Track Screen Views** - Use with navigation
4. **Identify Users** - Track after login
5. **Handle Errors** - Wrap in try/catch
6. **Enable Offline Tracking** - For better data collection

## License

MIT
