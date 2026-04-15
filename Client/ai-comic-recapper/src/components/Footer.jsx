const Footer = () => {
  return (
    <footer className="w-full max-w-5xl mt-8 pb-4">
      <div className="text-center text-text-muted text-xs border-t border-white/5 pt-4">
        Data provided by{' '}
        <a
          href="https://metron.cloud"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-blue hover:text-accent-cyan transition-colors duration-200"
        >
          Metron.cloud
        </a>
      </div>
    </footer>
  )
}

export default Footer
