import Scanner from './components/Scanner'
import Footer from './components/Footer'
import Header from './components/Header'

function App() {
  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-6 w-full">
      <Header />
      <main className="flex-1 w-full max-w-5xl flex items-start justify-center pt-8">
        <Scanner />
      </main>
      <Footer />
    </div>
  )
}

export default App
