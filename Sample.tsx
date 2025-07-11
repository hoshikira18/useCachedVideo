import React from 'react'

import { useCachedVideo } from '@/hooks/useCachedVideo'

import { VideoView, useVideoPlayer } from 'expo-video'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'

interface SimpleCachedVideoProps {
  videoUrl: string
  enableCaching?: boolean
  onCacheComplete?: (cachedPath: string) => void
}

/**
 * Simple example component showing how to use the useCachedVideo hook
 */
export const SimpleCachedVideo: React.FC<SimpleCachedVideoProps> = ({
  videoUrl,
  enableCaching = true,
  onCacheComplete,
}) => {
  // Use the cached video hook
  const { videoSource, isLoading, error, cacheProgress, isCached, clearCache, preloadVideo } =
    useCachedVideo(
      {
        uri: videoUrl,
        useCaching: enableCaching,
      },
      {
        enableCaching,
        enablePreload: true,
        maxCacheSize: 500, // 500MB
        cacheDirectory: 'my-videos',
      },
    )

  // Create video player with the cached source
  const player = useVideoPlayer(videoSource, player => {
    player.loop = true
    player.muted = false
  })

  // Handle cache completion
  React.useEffect(() => {
    if (
      isCached &&
      videoSource &&
      typeof videoSource === 'object' &&
      'uri' in videoSource &&
      videoSource.uri &&
      onCacheComplete
    ) {
      onCacheComplete(videoSource.uri)
    }
  }, [isCached, videoSource, onCacheComplete])

  // Preload function
  const handlePreload = async () => {
    if (videoUrl) {
      const cachedPath = await preloadVideo(videoUrl)
      console.log('Video preloaded to:', cachedPath)
    }
  }

  return (
    <View className="flex-1 bg-black">
      {/* Video Player */}
      <VideoView
        player={player}
        style={{ flex: 1 }}
        contentFit="contain"
        allowsFullscreen
        allowsPictureInPicture
      />

      {/* Loading Overlay */}
      {isLoading && (
        <View className="absolute inset-0 items-center justify-center bg-black/50">
          <ActivityIndicator size="large" color="white" />
          <Text className="mt-2 text-white">
            {cacheProgress > 0 ? `Caching video... ${cacheProgress}%` : 'Loading video...'}
          </Text>
        </View>
      )}

      {/* Error Display */}
      {error && (
        <View className="absolute bottom-20 left-4 right-4 rounded bg-red-500 p-2">
          <Text className="text-center text-white">{error}</Text>
        </View>
      )}

      {/* Controls */}
      <View className="absolute bottom-0 left-0 right-0 bg-black/70 p-4">
        <View className="flex-row items-center justify-between">
          {/* Cache Status */}
          <View className="flex-1">
            <Text className="text-sm text-white">
              Status: {isCached ? '✅ Cached' : '⏳ Not cached'}
            </Text>
            {cacheProgress > 0 && cacheProgress < 100 && (
              <View className="mt-1 h-2 rounded bg-gray-600">
                <View
                  className="h-full rounded bg-blue-500"
                  style={{ width: `${cacheProgress}%` }}
                />
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View className="ml-4 flex-row space-x-2">
            <TouchableOpacity
              onPress={() => (player.playing ? player.pause() : player.play())}
              className="rounded bg-blue-500 px-4 py-2"
            >
              <Text className="text-white">{player.playing ? 'Pause' : 'Play'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handlePreload}
              className="rounded bg-green-500 px-4 py-2"
              disabled={isLoading}
            >
              <Text className="text-white">Preload</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={clearCache} className="rounded bg-red-500 px-4 py-2">
              <Text className="text-white">Clear Cache</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  )
}

export default SimpleCachedVideo
