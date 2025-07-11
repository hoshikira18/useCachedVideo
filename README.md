# useCachedVideo Hook

A custom React hook for managing cached video playback using `expo-video` and `expo-file-system`. This hook automatically handles video caching, loading states, cache management, and provides utilities for preloading videos.

## Features

- **Automatic Caching**: Downloads and caches videos locally for faster subsequent playback
- **Cache Management**: Automatically manages cache size with LRU (Least Recently Used) eviction
- **Loading States**: Provides loading indicators and progress tracking
- **Error Handling**: Graceful error handling with fallback to original URLs
- **Preloading**: Support for preloading videos in the background
- **Flexible Configuration**: Customizable cache directory, size limits, and caching behavior

## Installation

The hook uses the following dependencies that should already be installed in your Expo project:

```bash
expo install expo-video expo-file-system
```

## Basic Usage

```tsx
import React from 'react'

import { useCachedVideo } from '@/hooks/useCachedVideo'

import { VideoView, useVideoPlayer } from 'expo-video'

const MyVideoComponent = () => {
  const { videoSource, isLoading, error, isCached, cacheProgress } = useCachedVideo(
    { uri: 'https://example.com/video.mp4', useCaching: true },
    { enableCaching: true, maxCacheSize: 500 },
  )

  const player = useVideoPlayer(videoSource)

  return <VideoView player={player} style={{ width: 300, height: 200 }} />
}
```

## API Reference

### `useCachedVideo(source, options)`

#### Parameters

**`source`** - The video source configuration

- `uri: string | null` - Video URL
- `useCaching?: boolean` - Whether to enable caching for this specific video

**`options`** - Configuration options (all optional)

- `enableCaching?: boolean` - Global caching toggle (default: `true`)
- `cacheDirectory?: string` - Cache directory name (default: `'videos'`)
- `maxCacheSize?: number` - Maximum cache size in MB (default: `500`)
- `enablePreload?: boolean` - Auto-preload when source changes (default: `false`)

#### Returns

- `videoSource: VideoSource` - The video source to use with `useVideoPlayer`
- `isLoading: boolean` - Whether video is currently loading/downloading
- `error: string | null` - Any error that occurred during caching
- `cacheProgress: number` - Download progress (0-100)
- `isCached: boolean` - Whether the video is cached locally
- `clearCache: () => Promise<void>` - Function to clear all cached videos
- `preloadVideo: (url: string) => Promise<string | null>` - Function to preload a video

## Advanced Usage

### With Cache Management

```tsx
const VideoPlayer = ({ videoUrl }) => {
  const { videoSource, isLoading, isCached, cacheProgress, clearCache, preloadVideo } =
    useCachedVideo(
      { uri: videoUrl, useCaching: true },
      {
        enableCaching: true,
        maxCacheSize: 1000, // 1GB cache
        cacheDirectory: 'my-app-videos',
        enablePreload: true,
      },
    )

  const player = useVideoPlayer(videoSource)

  const handlePreloadNext = async () => {
    await preloadVideo('https://example.com/next-video.mp4')
  }

  const handleClearCache = async () => {
    await clearCache()
    console.log('Cache cleared!')
  }

  return (
    <View>
      <VideoView player={player} style={{ flex: 1 }} />

      {isLoading && (
        <View style={{ position: 'absolute', top: 10, right: 10 }}>
          <Text>Loading... {cacheProgress}%</Text>
        </View>
      )}

      <Text>Status: {isCached ? 'Cached' : 'Not cached'}</Text>

      <Button title="Preload Next" onPress={handlePreloadNext} />
      <Button title="Clear Cache" onPress={handleClearCache} />
    </View>
  )
}
```

### Integration with Existing Components

To integrate with your existing `CircleViewVideo` component:

```tsx
// In your CircleViewVideo component
const CircleViewVideo = props => {
  const {
    videoSource: cachedVideoSource,
    isLoading: isCacheLoading,
    isCached,
  } = useCachedVideo(props.videoSource, {
    enableCaching: true,
    enablePreload: true,
  })

  const player = useVideoPlayer(cachedVideoSource, player => {
    player.pause()
    player.timeUpdateEventInterval = 0.016
  })

  // Update loading state to include cache loading
  useEffect(() => {
    setIsVideoLoading(isCacheLoading)
  }, [isCacheLoading])

  // Rest of your component logic...
}
```

### Preloading Videos

```tsx
const VideoList = ({ videos }) => {
  const { preloadVideo } = useCachedVideo({ uri: null })

  useEffect(() => {
    // Preload next few videos
    videos.slice(1, 4).forEach(video => {
      preloadVideo(video.url)
    })
  }, [videos])

  // Render current video...
}
```

## Cache Management

The hook automatically manages cache size using a Least Recently Used (LRU) strategy:

1. **Size Monitoring**: Tracks total cache size
2. **Automatic Cleanup**: Removes oldest files when cache exceeds `maxCacheSize`
3. **Threshold**: Cleans up to 80% of max size to prevent frequent cleanups

### Manual Cache Control

```tsx
const { clearCache } = useCachedVideo(source)

// Clear all cached videos
await clearCache()

// Check if specific video is cached
const isVideoCached = isCached && videoSource.uri?.startsWith('file://')
```

## Best Practices

1. **Cache Size**: Set appropriate `maxCacheSize` based on your app's needs and device storage
2. **Preloading**: Use preloading sparingly to avoid unnecessary network usage
3. **Error Handling**: Always handle the `error` state gracefully
4. **Loading States**: Show appropriate loading indicators during cache operations
5. **Cache Directory**: Use descriptive cache directory names for multiple video types

## Examples

See the example components:

- `SimpleCachedVideo.tsx` - Basic usage example
- `CircleViewVideoWithCache.tsx` - Integration with existing video component

## Troubleshooting

### Common Issues

1. **Videos not caching**: Check if `enableCaching` is true and `useCaching` is not false
2. **Cache not clearing**: Ensure you're calling `clearCache()` and handling any errors
3. **High memory usage**: Reduce `maxCacheSize` or implement more aggressive cleanup
4. **Slow loading**: Consider enabling preloading for better user experience

### Debug Information

The hook logs cache operations to the console. Enable debugging to see:

- Cache hits/misses
- Download progress
- Cache management operations
- Error details
