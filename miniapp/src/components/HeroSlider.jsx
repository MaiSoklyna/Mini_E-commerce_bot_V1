import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  HiShoppingBag,
  HiSparkles,
  HiCreditCard,
  HiUserGroup,
  HiBuildingStorefront,
  HiChevronLeft,
  HiChevronRight,
} from 'react-icons/hi2'

/* ═══════ SLIDE DATA ═══════ */
const SLIDES = [
  {
    id: 'shop',
    badge: 'New',
    title: 'Start Shopping',
    titleKh: 'ចាប់ផ្តើមទិញទំនិញ',
    subtitle: 'Discover hundreds of products from trusted local merchants',
    subtitleKh: 'រកឃើញផលិតផលរាប់រយពីអ្នកលក់ដែលគួរឱ្យទុកចិត្ត',
    pills: ['Free Delivery', 'Best Prices', 'Telegram Bot'],
    Icon: HiShoppingBag,
    cta: 'Browse Products',
    ctaPath: '/search',
    gradient: 'from-[#0f1a2e] via-[#162d50] to-[#1e3a5f]',
    orbColors: ['bg-accent/30', 'bg-cyan/20', 'bg-blue/15'],
  },
  {
    id: 'deals',
    badge: 'Hot',
    title: 'Exclusive Deals',
    titleKh: 'ការផ្តល់ជូនពិសេស',
    subtitle: 'Grab daily promo codes & discounts up to 50% off every day',
    subtitleKh: 'ទទួលបានកូដបញ្ចុះតម្លៃរៀងរាល់ថ្ងៃរហូតដល់ 50%',
    pills: ['Daily Deals', 'Promo Codes', 'Flash Sale'],
    Icon: HiSparkles,
    cta: 'View Deals',
    ctaPath: '/search',
    gradient: 'from-[#4c1d95] via-[#6d28d9] to-[#7c3aed]',
    orbColors: ['bg-purple/30', 'bg-pink-400/20', 'bg-yellow-400/15'],
  },
  {
    id: 'payments',
    badge: 'Secure',
    title: 'Easy Payments',
    titleKh: 'ការទូទាត់ងាយស្រួល',
    subtitle: 'Pay securely with KHQR, cash on delivery, or bank transfer',
    subtitleKh: 'បង់ប្រាក់ដោយសុវត្ថិភាពតាម KHQR ឬសាច់ប្រាក់',
    pills: ['KHQR', 'Cash on Delivery', 'Bank Transfer'],
    Icon: HiCreditCard,
    cta: 'Learn More',
    ctaPath: '/search',
    gradient: 'from-[#064e3b] via-[#065f46] to-[#047857]',
    orbColors: ['bg-emerald-400/30', 'bg-teal-300/20', 'bg-green-400/15'],
  },
  {
    id: 'merchants',
    badge: 'Popular',
    title: 'Top Merchants',
    titleKh: 'ហាងល្បីៗ',
    subtitle: 'Shop from the best-rated and most popular local stores',
    subtitleKh: 'ទិញពីហាងដែលមានការវាយតម្លៃខ្ពស់បំផុត',
    pills: ['Verified', 'Top Rated', 'Fast Shipping'],
    Icon: HiUserGroup,
    cta: 'Explore Shops',
    ctaPath: '/search',
    gradient: 'from-[#1e3a5f] via-[#1e40af] to-[#2563eb]',
    orbColors: ['bg-blue-400/30', 'bg-sky-300/20', 'bg-indigo-400/15'],
  },
  {
    id: 'open-shop',
    badge: 'Earn',
    title: 'Open Your Shop',
    titleKh: 'បើកហាងរបស់អ្នក',
    subtitle: 'Become a merchant — zero cost, instant setup, reach thousands',
    subtitleKh: 'ក្លាយជាអ្នកលក់ ដោយឥតគិតថ្លៃ ឈានដល់អតិថិជនរាប់ពាន់',
    pills: ['Zero Cost', 'Dashboard', 'Analytics'],
    Icon: HiBuildingStorefront,
    cta: 'Get Started',
    ctaPath: '/search',
    gradient: 'from-[#92400e] via-[#b45309] to-[#d97706]',
    orbColors: ['bg-amber-400/30', 'bg-orange-300/20', 'bg-yellow-400/15'],
  },
]

const AUTO_PLAY_MS = 5000

export default function HeroSlider() {
  const navigate = useNavigate()
  const [current, setCurrent] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [progress, setProgress] = useState(0)
  const intervalRef = useRef(null)
  const progressRef = useRef(null)
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)

  /* ── navigation helpers ── */
  const goTo = useCallback((i) => {
    if (isTransitioning) return
    setIsTransitioning(true)
    setCurrent(i)
    setProgress(0)
    setTimeout(() => setIsTransitioning(false), 500)
  }, [isTransitioning])

  const next = useCallback(() => goTo((current + 1) % SLIDES.length), [current, goTo])
  const prev = useCallback(() => goTo((current - 1 + SLIDES.length) % SLIDES.length), [current, goTo])

  /* ── auto-play + progress bar ── */
  const startAutoPlay = useCallback(() => {
    clearInterval(intervalRef.current)
    clearInterval(progressRef.current)

    setProgress(0)
    let p = 0
    const step = 100 / (AUTO_PLAY_MS / 50) // update every 50ms
    progressRef.current = setInterval(() => {
      p += step
      setProgress(Math.min(p, 100))
    }, 50)

    intervalRef.current = setInterval(() => {
      setCurrent(prev => {
        const nextIdx = (prev + 1) % SLIDES.length
        setProgress(0)
        // restart progress
        clearInterval(progressRef.current)
        let p2 = 0
        progressRef.current = setInterval(() => {
          p2 += step
          setProgress(Math.min(p2, 100))
        }, 50)
        return nextIdx
      })
    }, AUTO_PLAY_MS)
  }, [])

  useEffect(() => {
    startAutoPlay()
    return () => { clearInterval(intervalRef.current); clearInterval(progressRef.current) }
  }, [startAutoPlay])

  const resetAutoPlay = useCallback(() => startAutoPlay(), [startAutoPlay])

  /* ── touch / swipe ── */
  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchMove = (e) => { touchEndX.current = e.touches[0].clientX }
  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current
    if (Math.abs(diff) > 50) { diff > 0 ? next() : prev(); resetAutoPlay() }
  }

  const slide = SLIDES[current]

  return (
    <div className="mb-5">
      {/* ── Main Container ── */}
      <div
        className="relative overflow-hidden rounded-card-lg shadow-card"
        style={{ minHeight: 260 }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* ── Slides Track ── */}
        <div
          className="flex transition-transform duration-500 ease-out-expo"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {SLIDES.map((s, i) => (
            <div
              key={s.id}
              className={`w-full flex-shrink-0 relative overflow-hidden bg-gradient-to-br ${s.gradient}`}
              style={{ minHeight: 260 }}
            >
              {/* Animated Orbs */}
              <div className={`hero-orb hero-orb-1 ${s.orbColors[0]}`} />
              <div className={`hero-orb hero-orb-2 ${s.orbColors[1]}`} />
              <div className={`hero-orb hero-orb-3 ${s.orbColors[2]}`} />

              {/* Content */}
              <div className="relative z-10 p-5 flex gap-3 h-full" style={{ minHeight: 260 }}>
                {/* Left content */}
                <div className="flex-1 flex flex-col justify-center">
                  {/* Badge */}
                  <span className="inline-flex self-start items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase mb-2.5 bg-white/15 text-white backdrop-blur-sm border border-white/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                    {s.badge}
                  </span>

                  {/* Title EN */}
                  <h3 className="text-xl font-heading font-bold text-white leading-tight mb-0.5">
                    {s.title}
                  </h3>
                  {/* Title KH */}
                  <p className="text-[11px] text-white/50 font-medium mb-2">
                    {s.titleKh}
                  </p>

                  {/* Subtitle EN */}
                  <p className="text-[12px] text-white/70 leading-relaxed mb-3 max-w-[220px]">
                    {s.subtitle}
                  </p>

                  {/* Pills */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {s.pills.map(pill => (
                      <span key={pill} className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-white/10 text-white/80 border border-white/10 backdrop-blur-sm">
                        {pill}
                      </span>
                    ))}
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => { navigate(s.ctaPath); resetAutoPlay() }}
                    className="self-start px-4 py-2 rounded-full bg-accent text-black text-xs font-bold active:scale-95 transition-all hover:bg-accent-hover shadow-lg shadow-accent/20"
                  >
                    {s.cta}
                  </button>
                </div>

                {/* Right: big icon visual */}
                <div className="flex items-center justify-center w-20 flex-shrink-0">
                  <div className="relative">
                    <div className="absolute inset-0 bg-white/5 rounded-3xl blur-xl scale-150" />
                    <s.Icon className="relative w-16 h-16 text-white/25" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Left / Right Arrows ── */}
        <button
          onClick={() => { prev(); resetAutoPlay() }}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white/80 active:scale-90 transition-transform hover:bg-black/30"
          aria-label="Previous slide"
        >
          <HiChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => { next(); resetAutoPlay() }}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white/80 active:scale-90 transition-transform hover:bg-black/30"
          aria-label="Next slide"
        >
          <HiChevronRight className="w-4 h-4" />
        </button>

        {/* ── Progress Bar (top) ── */}
        <div className="absolute top-0 left-0 right-0 z-20 h-[3px] bg-white/10">
          <div
            className="h-full bg-accent transition-[width] duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* ── Dot Indicators ── */}
      <div className="flex items-center justify-center gap-1.5 mt-3">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => { goTo(i); resetAutoPlay() }}
            className={`rounded-full transition-all duration-300 ${
              i === current
                ? 'w-6 h-1.5 bg-accent'
                : 'w-1.5 h-1.5 bg-text-tertiary/30 hover:bg-text-tertiary/50'
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
