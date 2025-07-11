import { useCallback, useEffect, useState } from 'react'

import * as FileSystem from 'expo-file-system'
import { VideoSource } from 'expo-video'

export interface CachedVideoSource {
  uri: string | null
  useCaching?: boolean
}

export interface UseCachedVideoReturn {
  videoSource: VideoSource
  isLoading: boolean
  error: string | null
  cacheProgress: number
  isCached: boolean
  clearCache: () => Promise<void>
  preloadVideo: (url: string) => Promise<string | null>
}

export interface UseCachedVideoOptions {
  enableCaching?: boolean
  cacheDirectory?: string
  maxCacheSize?: number // in MB
  enablePreload?: boolean
}

const DEFAULT_OPTIONS: Required<UseCachedVideoOptions> = {
  enableCaching: true,
  cacheDirectory: 'videos',
  maxCacheSize: 500, // 500MB default
  enablePreload: false,
}

/**
 * Custom hook for managing cached video playback with expo-video and expo-file-system
 *
 * @param source - Video source with URI and caching options
 * @param options - Configuration options for caching behavior
 * @returns Object containing video source, loading state, cache info and utility functions
 */
export const useCachedVideo = (
  source: CachedVideoSource,
  options: UseCachedVideoOptions = {},
): UseCachedVideoReturn => {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options }
  const [videoSource, setVideoSource] = useState<VideoSource>({ uri: '' })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cacheProgress, setCacheProgress] = useState(0)
  const [isCached, setIsCached] = useState(false)

  // Create cache directory path
  const cacheDir = `${FileSystem.documentDirectory}${mergedOptions.cacheDirectory}/`

  // Generate cache filename from URL
  const getCacheFilename = useCallback((url: string): string => {
    const urlParts = url.split('/')
    const filename = urlParts[urlParts.length - 1]
    const timestamp = Date.now()

    // Handle URLs without file extensions
    if (!filename.includes('.')) {
      return `video_${timestamp}.mp4`
    }

    return filename.includes('?') ? filename.split('?')[0] : filename
  }, [])

  // Get cache file path
  const getCacheFilePath = useCallback(
    (url: string): string => {
      return `${cacheDir}${getCacheFilename(url)}`
    },
    [cacheDir, getCacheFilename],
  )

  // Check if video is cached
  const checkIfCached = useCallback(
    async (url: string): Promise<boolean> => {
      try {
        const filePath = getCacheFilePath(url)
        const fileInfo = await FileSystem.getInfoAsync(filePath)
        return fileInfo.exists
      } catch (error) {
        console.warn('Error checking cache:', error)
        return false
      }
    },
    [getCacheFilePath],
  )

  // Ensure cache directory exists
  const ensureCacheDirectory = useCallback(async (): Promise<void> => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(cacheDir)
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true })
      }
    } catch (error) {
      console.error('Error creating cache directory:', error)
      throw error
    }
  }, [cacheDir])

  // Check and manage cache size
  const manageCacheSize = useCallback(async (): Promise<void> => {
    try {
      const files = await FileSystem.readDirectoryAsync(cacheDir)
      const fileInfos = await Promise.all(
        files.map(async file => {
          const filePath = `${cacheDir}${file}`
          const info = await FileSystem.getInfoAsync(filePath, { size: true })
          return { ...info, name: file, path: filePath }
        }),
      )

      // Filter only existing files and calculate total size
      const existingFiles = fileInfos.filter(file => file.exists && !file.isDirectory)
      const totalSize = existingFiles.reduce((sum, file) => {
        return sum + (file.exists && 'size' in file ? file.size : 0)
      }, 0)
      const totalSizeMB = totalSize / (1024 * 1024)

      if (totalSizeMB > mergedOptions.maxCacheSize) {
        // Sort files by modification time (oldest first)
        const sortedFiles = existingFiles
          .filter(file => file.exists && 'modificationTime' in file)
          .sort((a, b) => {
            const timeA = a.exists && 'modificationTime' in a ? a.modificationTime : 0
            const timeB = b.exists && 'modificationTime' in b ? b.modificationTime : 0
            return timeA - timeB
          })

        let currentSize = totalSizeMB
        for (const file of sortedFiles) {
          if (currentSize <= mergedOptions.maxCacheSize * 0.8) break // Keep 80% of max size

          await FileSystem.deleteAsync(file.path)
          const fileSize = file.exists && 'size' in file ? file.size : 0
          currentSize -= fileSize / (1024 * 1024)
        }
      }
    } catch (error) {
      console.warn('Error managing cache size:', error)
    }
  }, [cacheDir, mergedOptions.maxCacheSize])

  // Download and cache video
  const downloadVideo = useCallback(
    async (url: string): Promise<string | null> => {
      try {
        setIsLoading(true)
        setError(null)
        setCacheProgress(0)

        await ensureCacheDirectory()
        await manageCacheSize()

        const filePath = getCacheFilePath(url)

        // Check if already cached
        if (await checkIfCached(url)) {
          setIsCached(true)
          return filePath
        }

        // Download with progress tracking
        const downloadResumable = FileSystem.createDownloadResumable(
          url,
          filePath,
          {},
          downloadProgress => {
            const progress =
              downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite
            setCacheProgress(Math.round(progress * 100))
          },
        )

        const result = await downloadResumable.downloadAsync()

        if (result?.uri) {
          setIsCached(true)
          setCacheProgress(100)
          return result.uri
        }

        throw new Error('Download failed')
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Download failed'
        setError(errorMessage)
        console.error('Error downloading video:', err)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [ensureCacheDirectory, manageCacheSize, getCacheFilePath, checkIfCached],
  )

  // Preload video function
  const preloadVideo = useCallback(
    async (url: string): Promise<string | null> => {
      if (!mergedOptions.enableCaching) return null
      return downloadVideo(url)
    },
    [downloadVideo, mergedOptions.enableCaching],
  )

  // Clear all cached videos
  const clearCache = useCallback(async (): Promise<void> => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(cacheDir)
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(cacheDir)
      }
      setIsCached(false)
      setCacheProgress(0)
    } catch (error) {
      console.error('Error clearing cache:', error)
      setError('Failed to clear cache')
    }
  }, [cacheDir])

  // Main effect to handle video source
  useEffect(() => {
    const handleVideoSource = async () => {
      if (!source.uri) {
        setVideoSource({ uri: '' })
        return
      }

      // If caching is disabled, use original URL
      if (!mergedOptions.enableCaching || source.useCaching === false) {
        setVideoSource({
          uri: source.uri,
          useCaching: false,
        })
        return
      }

      try {
        setIsLoading(true)
        setError(null)

        // Check if video is already cached
        const cached = await checkIfCached(source.uri)

        if (cached) {
          const cachedPath = getCacheFilePath(source.uri)
          setVideoSource({
            uri: cachedPath,
            useCaching: false,
          })
          setIsCached(true)
        } else {
          // Use original URL while downloading in background
          setVideoSource({
            uri: source.uri,
            useCaching: false,
          })
          setIsCached(false)

          // Download and cache for next time
          if (mergedOptions.enablePreload) {
            downloadVideo(source.uri)
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        setError(errorMessage)
        // Fallback to original URL
        setVideoSource({
          uri: source.uri,
          useCaching: false,
        })
      } finally {
        setIsLoading(false)
      }
    }

    handleVideoSource()
  }, [
    source.uri,
    source.useCaching,
    mergedOptions.enableCaching,
    mergedOptions.enablePreload,
    checkIfCached,
    getCacheFilePath,
    downloadVideo,
  ])

  return {
    videoSource,
    isLoading,
    error,
    cacheProgress,
    isCached,
    clearCache,
    preloadVideo,
  }
}

export default useCachedVideo
