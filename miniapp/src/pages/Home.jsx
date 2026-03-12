import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import * as merchantService from '../services/merchantService'
import * as categoryService from '../services/categoryService'
import * as productService from '../services/productService'
import ProductCard from '../components/ProductCard'
import HeroSlider from '../components/HeroSlider'
import SectionHeader from '../components/SectionHeader'
import EmptyState from '../components/EmptyState'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import {
  HiMagnifyingGlass,
  HiTruck,
  HiClipboardDocument,
  HiCheck,
  HiChevronRight,
  HiMiniStar,
} from 'react-icons/hi2'
import {
  HiSearch,
  HiShoppingCart,
  HiClipboardList,
  HiViewGrid,
  HiLightningBolt,
  HiCog,
  HiShieldCheck,
  HiUserGroup,
  HiTag,
  HiGlobe,
  HiChatAlt2,
} from 'react-icons/hi'
import {
  FaTelegramPlane,
  FaRobot,
  FaStore,
  FaBoxOpen,
  FaShoppingBasket,
  FaRegCopy,
  FaCheckCircle,
} from 'react-icons/fa'
import {
  BsSearch,
  BsShop,
  BsGrid3X3Gap,
  BsBox,
  BsCart3,
  BsListCheck,
  BsQuestionCircle,
} from 'react-icons/bs'

/* ═══════ HOW IT WORKS STEPS ═══════ */
const HOW_IT_WORKS = [
  {
    num: 1,
    icon: HiMagnifyingGlass,
    title: 'Browse & Discover',
    desc: 'Explore shops, search products, and find what you love',
    color: 'from-accent/15 to-cyan/5',
    iconColor: 'text-accent',
  },
  {
    num: 2,
    icon: HiShoppingCart,
    title: 'Add to Cart',
    desc: 'Pick items, set quantities, and apply promo codes',
    color: 'from-blue/15 to-blue/5',
    iconColor: 'text-blue',
  },
  {
    num: 3,
    icon: HiClipboardList,
    title: 'Checkout & Pay',
    desc: 'Enter your address, choose payment, and confirm order',
    color: 'from-purple/15 to-purple/5',
    iconColor: 'text-purple',
  },
  {
    num: 4,
    icon: HiTruck,
    title: 'Get Delivered',
    desc: 'Sit back and track — your order arrives at your door',
    color: 'from-gold/15 to-gold/5',
    iconColor: 'text-gold',
  },
]

/* ═══════ TELEGRAM KEYBOARD KEYS ═══════ */
const TG_KEYS = [
  { icon: BsQuestionCircle, label: 'How to Order', path: null },
  { icon: BsShop, label: 'Shops', path: '/search' },
  { icon: BsGrid3X3Gap, label: 'Categories', path: '/search' },
  { icon: BsBox, label: 'Products', path: '/search' },
  { icon: BsCart3, label: 'Cart', path: '/cart', showCount: true },
  { icon: BsListCheck, label: 'Orders', path: '/orders' },
]

/* ═══════ PLATFORM INFO ═══════ */
const PLATFORM_INFO = [
  {
    id: 'how',
    Icon: HiCog,
    title: 'How This Platform Works',
    iconClass: 'info-icon-works',
    items: [
      'Multi-vendor marketplace connecting local shops with customers',
      'Browse multiple shops and compare products in one place',
      'Order seamlessly via Telegram bot or our web app',
      'Real-time order tracking from checkout to delivery',
    ],
  },
  {
    id: 'owner',
    Icon: FaStore,
    title: 'Become a Shop Owner',
    iconClass: 'info-icon-owner',
    items: [
      'Register your shop and start selling in minutes',
      'Manage products, orders, and analytics from your dashboard',
      'Reach thousands of customers through Telegram',
      'Zero upfront cost \u2014 only pay when you sell',
    ],
  },
  {
    id: 'benefits',
    Icon: HiMiniStar,
    title: 'Why Choose Us',
    iconClass: 'info-icon-benefits',
    items: [
      'Free delivery on all orders over $50',
      'Exclusive promo codes and daily deals',
      'Secure, fast ordering via Telegram authentication',
      'Supporting and empowering local businesses',
    ],
  },
]


/* ═══════ SKELETON ═══════ */
function HomeSkeleton() {
  return (
    <div className="px-4 pt-4 pb-20">
      <div className="skeleton h-8 w-44 mb-1 rounded-lg" />
      <div className="skeleton h-3.5 w-28 mb-5 rounded-md" />
      <div className="skeleton h-11 w-full mb-5 rounded-button" />
      <div className="skeleton h-[260px] w-full mb-5 rounded-card-lg" />
      <div className="skeleton h-[56px] w-full mb-6 rounded-card" />
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="skeleton h-[340px] rounded-card-lg" />
        <div className="skeleton h-[340px] rounded-card-lg" />
      </div>
      <div className="skeleton h-4 w-24 mb-3 rounded-md" />
      <div className="grid grid-cols-3 gap-2.5 mb-6">
        {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton h-[76px] rounded-card" />)}
      </div>
      <div className="skeleton h-4 w-28 mb-3 rounded-md" />
      <div className="grid grid-cols-2 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="skeleton h-56 rounded-card" />)}
      </div>
    </div>
  )
}

/* ═══════ MAIN COMPONENT ═══════ */
export default function Home() {
  const navigate = useNavigate()
  const { user, loading: authLoading, loginPending, startLoginSession } = useAuth()
  const { count: cartCount } = useCart()
  const [merchants, setMerchants] = useState([])
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [promos, setPromos] = useState([])
  const [copiedCode, setCopiedCode] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedInfo, setExpandedInfo] = useState(null)

  useEffect(() => {
    Promise.all([
      merchantService.listMerchants(),
      categoryService.listCategories(),
      productService.listProducts({ limit: 10 }),
      merchantService.listActivePromos(),
    ]).then(([m, c, p, pr]) => {
      setMerchants(m)
      setCategories(c)
      setProducts(p)
      setPromos(pr)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const handleCopyCode = (code) => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    }).catch(() => {
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    })
  }

  const toggleInfo = (id) => setExpandedInfo(expandedInfo === id ? null : id)

  if (loading) return <HomeSkeleton />

  return (
    <div className="animate-fadeIn">

      {/* ═══════ HEADER ═══════ */}
      <div className="px-4 pt-4 pb-1">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-heading font-bold text-primary leading-tight">
              Favourite of Shop
            </h1>
            <p className="text-xs text-text-secondary mt-0.5">
              {user ? `Welcome back, ${user.first_name || user.username}` : 'Discover amazing local shops'}
            </p>
          </div>
          {!user && !authLoading && (
            <button
              onClick={startLoginSession}
              disabled={loginPending}
              className="ml-3 flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-accent text-black text-xs font-semibold active:scale-95 transition-transform disabled:opacity-50"
            >
              <FaTelegramPlane className="w-3.5 h-3.5" />
              {loginPending ? 'Waiting...' : 'Login'}
            </button>
          )}
        </div>
      </div>

      {/* ═══════ SEARCH BAR ═══════ */}
      <div className="px-4 py-3">
        <button
          onClick={() => navigate('/search')}
          className="w-full flex items-center gap-3 bg-card border border-border-light rounded-full px-4 py-2.5 active:scale-[0.98] transition-transform shadow-card"
          aria-label="Search products"
        >
          <HiMagnifyingGlass className="w-4 h-4 text-text-tertiary" />
          <span className="text-sm text-text-tertiary">Search products...</span>
        </button>
      </div>

      {/* ═══════ HERO SLIDER ═══════ */}
      <div className="px-4">
        <HeroSlider />
      </div>

      {/* ═══════ FREE DELIVERY BANNER ═══════ */}
      <div className="px-4 mb-6">
        <div className="delivery-banner flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex-shrink-0 flex items-center justify-center">
            <HiTruck className="w-5 h-5 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-primary">Free Delivery</p>
            <p className="text-[11px] text-text-secondary">On all orders over $50</p>
          </div>
          <span className="text-accent text-[10px] font-bold bg-accent/10 px-2.5 py-1 rounded-full flex-shrink-0">FREE</span>
        </div>
      </div>

      {/* ═══════ TWO-COLUMN SECTION ═══════ */}
      <section className="px-4 mb-6" aria-label="Platform Overview">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* ── LEFT: Live Telegram Preview ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FaTelegramPlane className="w-4 h-4 text-[#0088cc]" />
              <h3 className="text-sm font-heading font-bold text-primary">Live Telegram Preview</h3>
            </div>
            <div className="phone-mockup mx-auto">
              <div className="phone-notch" />
              <div className="phone-screen">
                {/* Telegram header */}
                <div className="tg-header">
                  <div className="tg-avatar">
                    <FaRobot className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-white text-xs font-bold">Favourite of Shop Bot</p>
                    <p className="text-white/60 text-[10px]">online</p>
                  </div>
                </div>

                {/* Welcome message */}
                <div className="tg-msg tg-msg-bot">
                  <p className="font-semibold text-[11px] mb-1">Welcome! <span className="text-accent">FavShop</span></p>
                  <p className="text-[10px] text-text-secondary">Your favourite marketplace on Telegram. Browse shops, order products, track deliveries!</p>
                </div>

                {/* Deal message */}
                <div className="tg-msg tg-msg-deal">
                  <div className="flex items-center gap-1.5 mb-1">
                    <HiLightningBolt className="w-3 h-3 text-accent" />
                    <span className="text-[10px] font-bold text-accent">Today's Deal</span>
                  </div>
                  <p className="text-[10px] text-text-secondary">Use code <span className="font-bold text-purple">KHMER24</span> for 15% off!</p>
                </div>

                {/* Typing indicator */}
                <div className="tg-msg tg-msg-bot inline-flex items-center gap-1 !py-2.5 !px-4">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>

                {/* Quick keyboard */}
                <div className="tg-keyboard">
                  {TG_KEYS.map((key) => (
                    <button
                      key={key.label}
                      className="tg-key"
                      onClick={() => key.path && navigate(key.path)}
                    >
                      <key.icon className="w-3 h-3" />
                      <span>{key.label}</span>
                      {key.showCount && cartCount > 0 && (
                        <span className="ml-0.5 bg-danger text-white text-[8px] px-1 py-0.5 rounded-full font-bold min-w-[14px] text-center leading-none">
                          {cartCount > 9 ? '9+' : cartCount}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT: How it works + Promo + CTA ── */}
          <div className="flex flex-col gap-4">
            {/* How it works */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <HiLightningBolt className="w-4 h-4 text-gold" />
                <h3 className="text-sm font-heading font-bold text-primary">How it Works</h3>
              </div>
              <div className="space-y-2.5">
                {HOW_IT_WORKS.map((step) => (
                  <div key={step.num} className="flex items-start gap-3 p-3 bg-card border border-border-light rounded-card transition-all hover:border-accent/30">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center flex-shrink-0`}>
                      <step.icon className={`w-4.5 h-4.5 ${step.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[9px] font-bold text-accent bg-accent/10 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0">
                          {step.num}
                        </span>
                        <p className="text-xs font-bold text-primary">{step.title}</p>
                      </div>
                      <p className="text-[10px] text-text-secondary leading-snug">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Promo Card: KHMER24 */}
            <div className="promo-highlight">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <HiTag className="w-4 h-4 text-purple" />
                  <span className="text-xs font-bold text-primary">Special Promo</span>
                </div>
                <span className="text-[9px] font-medium text-text-tertiary bg-surface-2 px-2 py-0.5 rounded-full">Ends Jan 31</span>
              </div>

              <div className="flex items-center justify-between bg-card rounded-xl p-3 border border-border-light mb-3">
                <div>
                  <p className="text-lg font-heading font-bold text-purple">15% OFF</p>
                  <p className="text-[11px] text-text-secondary">Use code below at checkout</p>
                </div>
                <div className="text-right">
                  <button
                    onClick={() => handleCopyCode('KHMER24')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple/10 border border-purple/20 active:scale-95 transition-all"
                  >
                    <span className="text-sm font-bold text-purple tracking-wider">KHMER24</span>
                    {copiedCode === 'KHMER24' ? (
                      <FaCheckCircle className="w-3.5 h-3.5 text-accent" />
                    ) : (
                      <FaRegCopy className="w-3 h-3 text-purple/60" />
                    )}
                  </button>
                  {copiedCode === 'KHMER24' && (
                    <p className="text-[9px] text-accent font-medium mt-1">Copied!</p>
                  )}
                </div>
              </div>

              {/* Open Your Shop CTA */}
              <button
                onClick={() => navigate('/search')}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-accent to-cyan text-black text-xs font-bold active:scale-[0.97] transition-transform shadow-lg shadow-accent/15"
              >
                <FaTelegramPlane className="w-3.5 h-3.5" />
                Open Your Shop on Telegram
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ PROMO CODES (from API) ═══════ */}
      {promos.length > 0 && (
        <section className="mb-6" aria-label="Promotions">
          <div className="px-4">
            <SectionHeader title="Promo Codes" />
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 pl-4 pr-4 scrollbar-hide">
            {promos.map(promo => (
              <button
                key={promo.id}
                onClick={() => handleCopyCode(promo.code)}
                className="promo-card focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                aria-label={`Copy promo code ${promo.code}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="bg-accent/10 text-accent text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-wider">
                    {promo.code}
                  </span>
                  <span className={`text-[10px] font-medium transition-colors inline-flex items-center gap-1 ${
                    copiedCode === promo.code ? 'text-accent' : 'text-text-tertiary'
                  }`}>
                    {copiedCode === promo.code ? (
                      <><FaCheckCircle className="w-2.5 h-2.5" /> Copied!</>
                    ) : (
                      <><FaRegCopy className="w-2.5 h-2.5" /> Tap to copy</>
                    )}
                  </span>
                </div>
                <p className="text-base font-bold text-primary">
                  {promo.type === 'percent' ? `${promo.value}% OFF` : `$${promo.value} OFF`}
                </p>
                <p className="text-[11px] text-text-secondary truncate mt-0.5">
                  {promo.merchant_name}
                </p>
                {promo.min_order > 0 && (
                  <p className="text-[10px] text-text-tertiary mt-1.5">
                    Min. order ${promo.min_order.toFixed(2)}
                  </p>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ═══════ CATEGORIES ═══════ */}
      {categories.length > 0 && (
        <section className="px-4 mb-6" aria-label="Categories">
          <SectionHeader title="Categories" />
          <div className="grid grid-cols-3 gap-2.5" role="list">
            {categories.map(cat => (
              <button
                key={cat.id}
                role="listitem"
                onClick={() => navigate(`/search?category=${cat.id}`)}
                className="flex flex-col items-center gap-1.5 py-3.5 px-2 rounded-card bg-card border border-border-light active:scale-95 hover:border-accent/30 transition-all shadow-card min-h-[72px]"
                aria-label={`${cat.name}, ${cat.product_count || 0} products`}
              >
                <span className="text-xl leading-none">{cat.icon_emoji || '📂'}</span>
                <span className="text-[11px] font-semibold text-primary text-center leading-tight">{cat.name}</span>
                <span className="text-[10px] text-text-tertiary">{cat.product_count || 0}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ═══════ SHOPS ═══════ */}
      {merchants.length > 0 && (
        <section className="px-4 mb-6" aria-label="Shops">
          <SectionHeader title="Shops" actionText="See All" actionPath="/search" />
          <div className="space-y-2.5">
            {merchants.map(m => (
              <button
                key={m.id}
                onClick={() => navigate(`/shop/${m.id}`)}
                className="w-full flex items-center gap-3 bg-card border border-border-light rounded-card p-3.5 active:scale-[0.98] hover:border-accent/30 transition-all shadow-card"
                aria-label={`${m.name}, ${m.product_count || 0} products`}
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent/10 to-cyan/5 flex-shrink-0 flex items-center justify-center">
                  <FaStore className="w-5 h-5 text-accent" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-primary truncate">{m.name}</p>
                  <p className="text-[11px] text-text-secondary mt-0.5">{m.product_count || 0} products</p>
                </div>
                <HiChevronRight className="w-4 h-4 text-text-tertiary flex-shrink-0" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ═══════ NEW ARRIVALS ═══════ */}
      {products.length > 0 && (
        <section className="px-4 mb-6" aria-label="New Arrivals">
          <SectionHeader title="New Arrivals" actionText="See All" actionPath="/search" />
          <div className="grid grid-cols-2 gap-3">
            {products.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {/* ═══════ ABOUT THE PLATFORM ═══════ */}
      <section className="px-4 mb-6" aria-label="About the Platform">
        <SectionHeader title="About the Platform" />
        <div className="space-y-2.5">
          {PLATFORM_INFO.map((info) => (
            <div key={info.id} className="info-card">
              <div
                className="info-card-header"
                onClick={() => toggleInfo(info.id)}
                role="button"
                aria-expanded={expandedInfo === info.id}
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && toggleInfo(info.id)}
              >
                <div className={`info-card-icon ${info.iconClass}`}>
                  <info.Icon className="w-[18px] h-[18px]" />
                </div>
                <span className="text-xs font-bold text-primary flex-1 text-left">{info.title}</span>
                <span className={`info-card-arrow ${expandedInfo === info.id ? 'expanded' : ''}`}>
                  &#9656;
                </span>
              </div>
              <div className={`info-card-body ${expandedInfo === info.id ? 'expanded' : 'collapsed'}`}>
                <ul className="px-4 pb-3.5 space-y-2.5">
                  {info.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <div className="info-bullet" />
                      <span className="text-[11px] text-text-secondary leading-snug">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ EMPTY STATE ═══════ */}
      {products.length === 0 && merchants.length === 0 && (
        <EmptyState
          icon={<FaStore className="w-10 h-10 text-text-tertiary" />}
          title="No shops yet"
          description="Check back soon for amazing local shops"
        />
      )}

      {/* Bottom spacing */}
      <div className="h-4" />
    </div>
  )
}
