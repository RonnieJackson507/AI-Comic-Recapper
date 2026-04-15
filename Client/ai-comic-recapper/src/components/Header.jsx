const Header = () => {
  return (
    <header className="w-full max-w-5xl">
      <div className="backdrop-blur-md border border-white/15 rounded-2xl px-8 py-5 flex items-center justify-between" style={{ backgroundColor: 'rgba(255, 255, 255, 0.10)' }}>
        <div>
          <h1
            className="text-2xl font-bold bg-clip-text text-transparent m-0"
            style={{ backgroundImage: 'linear-gradient(to right, #70a8ff, #a78bfa, #45e0f5)' }}
          >
            AI Comic Book Recapper
          </h1>
          <p className="text-sm mt-1 mb-0" style={{ color: '#8e8ea0' }}>
            Scan a barcode. Get the story so far.
          </p>
        </div>
        <div className="text-3xl select-none" aria-hidden="true">📖</div>
      </div>
    </header>
  )
}

export default Header
