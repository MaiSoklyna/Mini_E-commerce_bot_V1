import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as productService from '../services/productService';
import PageHeader from '../components/PageHeader';
import ProductCard from '../components/ProductCard';
import EmptyState from '../components/EmptyState';
import { useCart } from '../context/CartContext';

const POPULAR_CATEGORIES = [
  { id: 1, name: 'Electronics', icon: '📱' },
  { id: 2, name: 'Fashion', icon: '👕' },
  { id: 3, name: 'Home & Living', icon: '🏠' },
  { id: 4, name: 'Beauty', icon: '💄' },
  { id: 5, name: 'Sports', icon: '⚽' },
  { id: 6, name: 'Books', icon: '📚' },
];

export default function Search() {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const searchInputRef = useRef(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [suggestedProducts, setSuggestedProducts] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      try { setRecentSearches(JSON.parse(saved)); } catch { setRecentSearches([]); }
    }
  }, []);

  useEffect(() => {
    if (searchInputRef.current) searchInputRef.current.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => performSearch(query), 350);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (hasSearched && results.length === 0) {
      productService.listProducts({ limit: 4 })
        .then(data => setSuggestedProducts(data))
        .catch(() => setSuggestedProducts([]));
    }
  }, [hasSearched, results.length]);

  const performSearch = async (searchQuery) => {
    try {
      const data = await productService.listProducts({ search: searchQuery, limit: 20 });
      setResults(data);
      setHasSearched(true);
      saveRecentSearch(searchQuery);
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
      setHasSearched(true);
    } finally {
      setSearching(false);
    }
  };

  const saveRecentSearch = (searchQuery) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    const updated = [trimmed, ...recentSearches.filter(s => s !== trimmed)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  const removeRecentSearch = (searchTerm) => {
    const updated = recentSearches.filter(s => s !== searchTerm);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  const handleAddToCart = async (productId) => {
    await addToCart(productId, 1);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    searchInputRef.current?.focus();
  };

  return (
    <div className="page-container animate-fadeIn">
      <PageHeader title="Search" showBack={false} />

      {/* Search Bar */}
      <div className="px-4 pt-4 pb-3">
        <div className="relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full input-field pl-10 pr-10"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-surface flex items-center justify-center text-text-secondary hover:text-primary transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pb-20">
        {/* Empty State - Recent & Categories */}
        {!query && !hasSearched && (
          <div className="animate-fadeIn">
            {recentSearches.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-heading font-semibold text-primary mb-3">Recent</h3>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((search, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1.5 bg-card border border-border-light rounded-full px-3 py-2 text-sm shadow-card"
                    >
                      <button
                        onClick={() => setQuery(search)}
                        className="text-primary hover:text-accent transition-colors text-[13px]"
                      >
                        {search}
                      </button>
                      <button
                        onClick={() => removeRecentSearch(search)}
                        className="text-text-tertiary hover:text-danger transition-colors w-4 h-4 flex items-center justify-center"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-heading font-semibold text-primary mb-3">Popular Categories</h3>
              <div className="grid grid-cols-2 gap-2.5">
                {POPULAR_CATEGORIES.map(category => (
                  <button
                    key={category.id}
                    onClick={() => setQuery(category.name)}
                    className="bg-card rounded-card shadow-card p-4 text-left hover:shadow-card-hover active:scale-[0.97] transition-all border border-border-light"
                  >
                    <div className="text-2xl mb-2">{category.icon}</div>
                    <h4 className="text-[13px] font-semibold text-primary">{category.name}</h4>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Searching State */}
        {searching && (
          <div className="grid grid-cols-2 gap-3 mt-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton h-64 rounded-card" />
            ))}
          </div>
        )}

        {/* Results */}
        {!searching && hasSearched && results.length > 0 && (
          <div className="animate-fadeIn">
            <p className="text-sm text-text-secondary mb-4">
              Found <span className="font-semibold text-primary">{results.length}</span> results for{' '}
              <span className="font-semibold text-primary">'{query}'</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              {results.map(product => (
                <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} />
              ))}
            </div>
          </div>
        )}

        {/* No Results */}
        {!searching && hasSearched && results.length === 0 && (
          <div className="animate-fadeIn">
            <EmptyState
              icon="🔍"
              title="No products found"
              description="Try different keywords or browse our suggestions"
              className="pt-8 pb-6"
            />
            {suggestedProducts.length > 0 && (
              <div>
                <h4 className="text-sm font-heading font-semibold text-primary mb-3">You might like</h4>
                <div className="grid grid-cols-2 gap-3">
                  {suggestedProducts.map(product => (
                    <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
