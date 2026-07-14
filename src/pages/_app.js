import '../styles/globals.css'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Bricolage_Grotesque, Space_Mono, Space_Grotesk } from 'next/font/google'
import { ReactLenis } from 'lenis/react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { AuthProvider } from '../components/AuthContext'

const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-bricolage', display: 'swap' })
const mono = Space_Mono({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-space-mono', display: 'swap' })
const body = Space_Grotesk({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-space-grotesk', display: 'swap' })

// Halaman "berdiri sendiri" tanpa navbar/footer (error login).
const BARE_PAGES = ['/auth-error']

function MyApp({ Component, pageProps }) {
  const { pathname } = useRouter()
  const bare = BARE_PAGES.includes(pathname)

  // Matikan smooth-wheel bila user memilih reduced motion.
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduce(m.matches)
    on()
    m.addEventListener?.('change', on)
    return () => m.removeEventListener?.('change', on)
  }, [])

  return (
    <ReactLenis root options={{ duration: 1.1, smoothWheel: !reduce }}>
      <AuthProvider>
        <div className={`${display.variable} ${mono.variable} ${body.variable} app-root flex flex-col min-h-screen bg-[var(--paper)] text-[var(--ink)]`}>
          {!bare && <Navbar />}
          <main className="flex-1">
            <Component {...pageProps} />
          </main>
          {!bare && <Footer />}
        </div>
      </AuthProvider>
    </ReactLenis>
  )
}

export default MyApp
