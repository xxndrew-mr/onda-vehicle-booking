import '../styles/globals.css'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { AuthProvider } from '../components/AuthContext'

function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <div className="flex flex-col min-h-screen bg-gray-100">
        <Navbar />
        <main className="flex-1">
          <Component {...pageProps} />
        </main>
        <Footer />
      </div>
    </AuthProvider>
  )
}

export default MyApp
