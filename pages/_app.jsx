import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google'
import '../styles/globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export default function App({ Component, pageProps }) {
  return (
    <div className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
      <Component {...pageProps} />
    </div>
  )
}
