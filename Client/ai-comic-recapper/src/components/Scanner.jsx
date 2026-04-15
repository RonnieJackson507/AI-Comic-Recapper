import { useEffect, useRef, useState } from 'react'
import Quagga from '@ericblade/quagga2'

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-20" style={{ animation: 'fade-in 0.5s ease-out forwards' }}>
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full border-2 border-white/10" />
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
          style={{ borderTopColor: '#4f8fff', borderRightColor: '#8b5cf6' }}
        />
        <div className="absolute inset-3 rounded-full animate-pulse" style={{ backgroundColor: 'rgba(79, 143, 255, 0.1)' }} />
      </div>
      <p className="mt-6 text-text-secondary text-sm font-medium">Looking up your comic...</p>
      <p className="mt-1 text-text-muted text-xs">Fetching data and generating recap</p>
    </div>
  )
}

function MetadataBadge({ label, value }) {
  if (!value) return null
  return (
    <div className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs">
      <span className="text-text-muted">{label}</span>
      <span className="text-text-primary font-medium">{value}</span>
    </div>
  )
}

export default function Scanner() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const processingRef = useRef(false)
  const [message, setMessage] = useState('')
  const [thumbnail, setThumbnail] = useState('')
  const [metadata, setMetadata] = useState(null)
  const [isScanning, setIsScanning] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isScanning || !videoRef.current) return

    Quagga.init({
      inputStream: {
        type: 'LiveStream',
        target: videoRef.current,
        constraints: {
          facingMode: 'environment',
          width: 640,
          height: 480,
        },
      },
      decoder: {
        readers: ['upc_reader'],
      },
    }, (err) => {
      if (err) {
        console.error('Quagga init error:', err)
        setError('Failed to access camera. Please check permissions.')
        return
      }
      Quagga.start()
      Quagga.onDetected(handleDetected)
    })

    return () => {
      Quagga.stop()
      Quagga.offDetected(handleDetected)
    }
  }, [isScanning])

  const handleDetected = async (result) => {
    const code = result.codeResult.code
    if (code.length !== 12) return
    if (processingRef.current) return
    processingRef.current = true

    // Stop Quagga immediately to prevent further detections
    Quagga.offDetected(handleDetected)
    Quagga.stop()

    try {
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      const video = videoRef.current?.querySelector('video')

      if (!video) {
        setError('Camera not available. Please try again.')
        processingRef.current = false
        return
      }

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      context.drawImage(video, 0, 0, canvas.width, canvas.height)

      setIsScanning(false)
      setIsLoading(true)
      setError('')

      canvas.toBlob(async (blob) => {
        try {
          const formData = new FormData()
          formData.append('metadata', JSON.stringify({ code }))
          formData.append('image', blob, 'frame.jpg')

          const response = await fetch('http://localhost:5000/recap', {
            method: 'POST',
            body: formData,
          })

          const data = await response.json()

          if (!response.ok) {
            setError(data.error || 'Something went wrong.')
            setIsLoading(false)
            return
          }

          setMessage(data.message || '')
          setThumbnail(data.thumbnail || '')
          setMetadata(data.metadata || null)
        } catch (err) {
          console.error('Fetch error:', err)
          setError('Failed to connect to the server. Make sure the backend is running.')
        } finally {
          setIsLoading(false)
        }
      }, 'image/jpeg')
    } catch (err) {
      console.error('Error capturing frame:', err)
      setError('Error capturing camera frame.')
      setIsLoading(false)
      processingRef.current = false
    }
  }

  const handleScanAgain = () => {
    setMessage('')
    setThumbnail('')
    setMetadata(null)
    setError('')
    processingRef.current = false
    setIsScanning(true)
  }

  // ---- SCANNING VIEW ----
  if (isScanning) {
    return (
      <div className="w-full max-w-lg" style={{ animation: 'fade-in 0.5s ease-out forwards' }}>
        <div
          className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6"
          style={{ animation: 'pulse-glow 2.5s ease-in-out infinite' }}
        >
          <div
            ref={videoRef}
            className="w-full rounded-xl overflow-hidden border border-white/5"
            style={{ aspectRatio: '4/3', backgroundColor: 'rgba(0,0,0,0.5)' }}
          />
          <div className="mt-4 text-center">
            <p className="text-text-secondary text-sm">
              Point your camera at a comic book barcode
            </p>
            <div className="mt-2 flex items-center justify-center gap-2">
              <span
                className="inline-block w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: '#4f8fff' }}
              />
              <span className="text-xs font-medium" style={{ color: '#4f8fff' }}>Scanning...</span>
            </div>
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    )
  }

  // ---- LOADING VIEW ----
  if (isLoading) {
    return (
      <div className="w-full max-w-2xl">
        <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-8">
          <LoadingSpinner />
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    )
  }

  // ---- ERROR VIEW ----
  if (error) {
    return (
      <div className="w-full max-w-lg" style={{ animation: 'fade-in 0.5s ease-out forwards' }}>
        <div
          className="backdrop-blur-md border rounded-2xl p-8 text-center"
          style={{ backgroundColor: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}
        >
          <div className="text-4xl mb-4">⚠️</div>
          <p className="font-medium" style={{ color: '#f87171' }}>{error}</p>
          <button
            onClick={handleScanAgain}
            className="mt-6 bg-white/10 hover:bg-white/15 border border-white/10 hover:border-white/20 text-text-primary font-medium py-2.5 px-6 rounded-xl transition-all duration-200 cursor-pointer"
          >
            Try Again
          </button>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    )
  }

  // ---- RESULTS VIEW ----
  const coverDate = metadata?.cover_date
    ? new Date(metadata.cover_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
    : null

  return (
    <div className="w-full max-w-4xl" style={{ animation: 'slide-up 0.5s ease-out forwards' }}>
      <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8">

        {/* Comic title + metadata badges */}
        {metadata && (
          <div className="mb-6 pb-5 border-b border-white/5">
            <h2 className="text-2xl font-bold text-text-primary m-0">
              {metadata.series_name}{' '}
              <span style={{ color: '#4f8fff' }}>#{metadata.issue_number}</span>
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <MetadataBadge label="Publisher" value={metadata.publisher} />
              <MetadataBadge label="Cover Date" value={coverDate} />
              {metadata.story_titles?.length > 0 && (
                <MetadataBadge label="Story" value={metadata.story_titles[0]} />
              )}
            </div>
          </div>
        )}

        {/* Side-by-side: cover LEFT, recap RIGHT */}
        <div className="flex flex-col md:flex-row gap-6">

          {/* Left: Cover Image */}
          {thumbnail && (
            <div className="flex-shrink-0 md:w-56">
              <div className="rounded-xl overflow-hidden border border-white/10 shadow-lg shadow-black/30">
                <img
                  src={thumbnail}
                  alt="Comic Cover"
                  className="w-full h-auto object-cover block"
                />
              </div>
            </div>
          )}

          {/* Right: Recap Text */}
          <div className="flex-1 min-w-0">
            <h3
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: '#6b6b80' }}
            >
              Recap
            </h3>
            <div className="text-text-secondary leading-relaxed text-sm space-y-3">
              {message.split('\n\n').filter(Boolean).map((paragraph, i) => (
                <p key={i} className="m-0">{paragraph}</p>
              ))}
            </div>
          </div>
        </div>

        {/* Scan Again button */}
        <div className="mt-8 pt-5 border-t border-white/5 flex justify-center">
          <button
            onClick={handleScanAgain}
            className="text-white font-medium py-2.5 px-8 rounded-xl transition-all duration-200 cursor-pointer"
            style={{
              background: 'linear-gradient(to right, #4f8fff, #8b5cf6)',
              boxShadow: '0 4px 20px rgba(79,143,255,0.2)',
            }}
            onMouseEnter={e => { e.target.style.boxShadow = '0 4px 28px rgba(79,143,255,0.35)'; e.target.style.opacity = '0.9' }}
            onMouseLeave={e => { e.target.style.boxShadow = '0 4px 20px rgba(79,143,255,0.2)'; e.target.style.opacity = '1' }}
          >
            Scan Another Comic
          </button>
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
