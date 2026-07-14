import '../styles/globals.css'
import { useRouter } from 'next/router'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { AuthProvider } from '../components/AuthContext'

// Halaman "berdiri sendiri" tanpa navbar/footer (error login).
const BARE_PAGES = ['/auth-error']

function MyApp({ Component, pageProps }) {
  const { pathname } = useRouter()
  const bare = BARE_PAGES.includes(pathname)

  return (
    <AuthProvider>
      <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900">
        {!bare && <Navbar />}
        {/* Background & tinggi ditangani di sini; halaman cukup mengisi konten. */}
        <main className="flex-1">
          <Component {...pageProps} />
        </main>
        {!bare && <Footer />}
      </div>
    </AuthProvider>
  )
}

export default MyApp
