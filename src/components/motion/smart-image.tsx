import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

interface SmartImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Optional skeleton overlay color. Defaults to bg-muted. */
  placeholderClassName?: string
  /** Whether to render a skeleton behind the image while it loads. */
  showPlaceholder?: boolean
}

/**
 * Drop-in <img> replacement that fades the image in after it decodes.
 * Prevents the "snap" of an image popping into view.
 */
export function SmartImage({
  className,
  placeholderClassName,
  showPlaceholder = true,
  onLoad,
  src,
  ...props
}: SmartImageProps) {
  const [loaded, setLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  // Handle cache hits where the load event fires before mount.
  useEffect(() => {
    const node = imgRef.current
    if (node?.complete && node.naturalWidth > 0) {
      setLoaded(true)
    }
  }, [src])

  return (
    <span className={cn("relative block overflow-hidden", placeholderClassName)}>
      {showPlaceholder && !loaded && (
        <span aria-hidden="true" className="absolute inset-0 animate-pulse bg-muted" />
      )}
      <img
        ref={imgRef}
        src={src}
        data-loaded={loaded ? "true" : "false"}
        onLoad={(event) => {
          setLoaded(true)
          onLoad?.(event)
        }}
        className={cn("smart-image-fade", className)}
        {...props}
      />
    </span>
  )
}
