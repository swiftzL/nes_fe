export const useImageBase = () => {
  const runtime = useRuntimeConfig()
  const makeUrl = (path?: string | null) => {
    if (!path) return ''
    if (/^(?:https?:)?\/\//i.test(path)) {
      return path
    }
    const base = runtime.public.imageBase || ''
    if (!base) {
      return path
    }
    const normalizedBase = base.replace(/\/+$/, '')
    const normalizedPath = path.replace(/^\/+/, '')
    return `${normalizedBase}/${normalizedPath}`
  }

  return {
    imageBase: runtime.public.imageBase,
    buildImageUrl: makeUrl
  }
}
