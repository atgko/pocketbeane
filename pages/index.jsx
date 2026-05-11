import Head from 'next/head'
import Link from 'next/link'

export default function Home() {
  return (
    <>
      <Head>
        <title>PocketBeane</title>
        <meta name="description" content="AI-powered fantasy basketball GM" />
      </Head>
      <main className="min-h-screen bg-bg flex flex-col items-center justify-center p-8">
        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
          PocketBeane
        </h1>
        <p className="text-gray-400 mb-10 text-lg">
          Your AI-powered fantasy basketball GM
        </p>
        <Link
          href="/draft"
          className="px-6 py-3 bg-pick text-white rounded-lg font-semibold hover:bg-green-500 transition-colors"
        >
          Go to Draft Board →
        </Link>
      </main>
    </>
  )
}
