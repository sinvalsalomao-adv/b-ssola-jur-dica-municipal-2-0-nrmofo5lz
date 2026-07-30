export function extractYouTubeId(url: string): string {
  if (!url) return ''
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]+)/,
    /(?:youtu\.be\/)([\w-]+)/,
    /(?:youtube\.com\/embed\/)([\w-]+)/,
    /(?:youtube\.com\/shorts\/)([\w-]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return url
}

export function getYouTubeEmbedUrl(url: string): string {
  const id = extractYouTubeId(url)
  return id ? `https://www.youtube.com/embed/${id}` : ''
}
