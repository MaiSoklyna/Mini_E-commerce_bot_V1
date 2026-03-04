import { useState, useEffect, useRef } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import api from '../api/axios';

const FAQ_ITEMS = [
  { question: 'How do I track my order?', answer: 'Go to "My Orders" from the bottom navigation, then select your order to view its current status.' },
  { question: 'Can I cancel my order?', answer: "You can cancel orders that are still in 'pending' status. Once confirmed by the merchant, contact support." },
  { question: 'What payment methods are accepted?', answer: 'We accept KHQR (all major Cambodian banks), Cash on Delivery (COD), and more.' },
  { question: 'How long does delivery take?', answer: "Delivery typically takes 3-5 business days depending on your location and the merchant." },
];

const SUBJECT_OPTIONS = ['Order Issue', 'Wrong Item', 'Refund Request', 'General Question', 'Other'];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const statusBadge = {
  open: { bg: 'bg-amber-50 text-amber-700', label: 'Open' },
  replied: { bg: 'bg-green-50 text-green-700', label: 'Replied' },
  closed: { bg: 'bg-surface-2 text-text-tertiary', label: 'Closed' },
};

export default function Support() {
  const { user, loginPending, startLoginSession } = useAuth();
  const location = useLocation();
  const { merchantId: paramMerchantId } = useParams();
  const navigate = useNavigate();

  const merchantId = paramMerchantId || location.state?.merchantId;
  const merchantName = location.state?.merchantName;

  if (merchantId) {
    return <MerchantSupport merchantId={merchantId} merchantName={merchantName} user={user} loginPending={loginPending} startLoginSession={startLoginSession} />;
  }
  return <TicketList user={user} navigate={navigate} loginPending={loginPending} startLoginSession={startLoginSession} />;
}

function TicketList({ user, navigate, loginPending, startLoginSession }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedFaq, setExpandedFaq] = useState(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    api.get('/support/tickets')
      .then(res => setTickets(res.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <div className="page-container">
        <PageHeader title="Help & Support" showBack={false} />
        <EmptyState
          icon="🔒"
          title="Login Required"
          description="Please login via Telegram to view support"
          actionLabel={loginPending ? 'Waiting...' : 'Login via Telegram'}
          onAction={startLoginSession}
          className="pt-20"
        />
      </div>
    );
  }

  return (
    <div className="page-container animate-fadeIn pb-20">
      <PageHeader title="Help & Support" showBack={false} />
      <div className="px-4 pt-4">
        {loading ? (
          <div className="space-y-2 mb-6">
            {[1, 2].map(i => <div key={i} className="skeleton h-20 rounded-card" />)}
          </div>
        ) : tickets.length > 0 ? (
          <div className="mb-6">
            <h2 className="text-sm font-heading font-bold text-primary mb-3">My Tickets</h2>
            <div className="space-y-2.5">
              {tickets.map(t => {
                const badge = statusBadge[t.status] || statusBadge.open;
                return (
                  <button
                    key={t.id}
                    onClick={() => navigate(`/support/${t.merchant_id}`, { state: { ticketId: t.id, merchantName: t.merchant_name } })}
                    className="w-full bg-card border border-border-light rounded-card p-3.5 text-left active:scale-[0.98] transition-all shadow-card"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-primary truncate">{t.subject}</p>
                        <p className="text-[11px] text-text-secondary mt-0.5">{t.merchant_name}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ml-2 ${badge.bg}`}>
                        {badge.label}
                      </span>
                    </div>
                    {t.last_message && (
                      <p className="text-[11px] text-text-tertiary truncate mt-1">
                        {t.last_sender === 'merchant' ? '↩ ' : ''}{t.last_message}
                      </p>
                    )}
                    <p className="text-[10px] text-text-tertiary mt-1">{timeAgo(t.updated_at || t.created_at)}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border-light rounded-card p-5 mb-6 text-center shadow-card">
            <p className="text-sm text-text-secondary">No support tickets yet</p>
            <p className="text-xs text-text-tertiary mt-1">Visit a shop to start a conversation</p>
          </div>
        )}

        {/* FAQ */}
        <div className="mb-6">
          <h2 className="text-sm font-heading font-bold text-primary mb-3">FAQ</h2>
          <div className="space-y-2">
            {FAQ_ITEMS.map((faq, index) => (
              <div key={index} className="bg-card border border-border-light rounded-card overflow-hidden">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left active:bg-surface transition-colors"
                >
                  <span className="text-[13px] font-semibold text-primary pr-3">{faq.question}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={`flex-shrink-0 transition-transform duration-200 ${expandedFaq === index ? 'rotate-180' : ''}`}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                <div className={`overflow-hidden transition-all duration-200 ${expandedFaq === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="px-4 pb-3">
                    <p className="text-xs text-text-secondary leading-relaxed">{faq.answer}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="bg-card border border-border-light rounded-card p-4 shadow-card">
          <h3 className="text-sm font-heading font-semibold text-primary mb-2">Contact Us</h3>
          <div className="space-y-2 text-xs text-text-secondary">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
              </svg>
              support@favouriteofshop.com
            </div>
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              Mon-Fri, 9AM-6PM (Cambodia)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MerchantSupport({ merchantId, merchantName, user, loginPending, startLoginSession }) {
  const location = useLocation();
  const ticketIdFromState = location.state?.ticketId;

  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [replyText, setReplyText] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadTicket();
  }, [user, ticketIdFromState, merchantId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadTicket = async () => {
    setLoading(true);
    try {
      if (ticketIdFromState) {
        const res = await api.get(`/support/tickets/${ticketIdFromState}`);
        setTicket(res.data.data);
        setMessages(res.data.data.messages || []);
      } else {
        const res = await api.get('/support/tickets');
        const existing = (res.data.data || []).find(t => String(t.merchant_id) === String(merchantId) && t.status !== 'closed');
        if (existing) {
          const detail = await api.get(`/support/tickets/${existing.id}`);
          setTicket(detail.data.data);
          setMessages(detail.data.data.messages || []);
        } else {
          setShowForm(true);
        }
      }
    } catch {
      setShowForm(true);
    }
    setLoading(false);
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!subject || !message.trim()) return;
    setSending(true);
    try {
      const res = await api.post('/support/tickets', { merchant_id: parseInt(merchantId), subject, message });
      const detail = await api.get(`/support/tickets/${res.data.data.id}`);
      setTicket(detail.data.data);
      setMessages(detail.data.data.messages || []);
      setShowForm(false);
      setSubject('');
      setMessage('');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create ticket');
    }
    setSending(false);
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !ticket) return;
    setSending(true);
    try {
      await api.post(`/support/tickets/${ticket.id}/messages`, { message: replyText });
      setReplyText('');
      const res = await api.get(`/support/tickets/${ticket.id}`);
      setTicket(res.data.data);
      setMessages(res.data.data.messages || []);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to send message');
    }
    setSending(false);
  };

  if (!user) {
    return (
      <div className="page-container">
        <PageHeader title="Support" />
        <EmptyState
          icon="🔒"
          title="Login Required"
          description="Please login via Telegram to contact the merchant"
          actionLabel={loginPending ? 'Waiting...' : 'Login via Telegram'}
          onAction={startLoginSession}
          className="pt-20"
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container">
        <PageHeader title={merchantName || 'Support'} />
        <div className="px-4 pt-4 space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-14 rounded-card" />)}
        </div>
      </div>
    );
  }

  if (showForm && !ticket) {
    return (
      <div className="page-container animate-fadeIn pb-20">
        <PageHeader title={merchantName || 'Contact Shop'} />
        <div className="px-4 pt-5">
          <div className="bg-card border border-border-light rounded-card p-4 shadow-card">
            <h3 className="text-sm font-heading font-semibold text-primary mb-3">
              Message {merchantName || 'this shop'}
            </h3>
            <form onSubmit={handleCreateTicket} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Subject</label>
                <select value={subject} onChange={(e) => setSubject(e.target.value)} className="input-field" required>
                  <option value="">Select a subject</option>
                  {SUBJECT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Message</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="input-field"
                  rows={4} placeholder="Describe your issue..." required minLength={5} />
              </div>
              <button type="submit" disabled={sending} className="w-full btn-primary py-3">
                {sending ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const badge = statusBadge[ticket?.status] || statusBadge.open;

  return (
    <div className="page-container animate-fadeIn flex flex-col" style={{ height: '100vh' }}>
      <PageHeader title={merchantName || ticket?.merchant_name || 'Support'} rightAction={
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${badge.bg}`}>{badge.label}</span>
          <button onClick={loadTicket} className="w-8 h-8 flex items-center justify-center rounded-full active:bg-surface transition-colors" aria-label="Refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>
      } />

      <div className="px-4 py-2 border-b border-border-light/50 bg-surface">
        <p className="text-xs font-semibold text-primary">{ticket?.subject}</p>
        {ticket?.order_id && <p className="text-[10px] text-text-tertiary">Order #{ticket.order_id}</p>}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.map((msg) => {
          const isCustomer = msg.sender_type === 'customer';
          return (
            <div key={msg.id} className={`flex mb-3 ${isCustomer ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-3.5 py-2.5 ${
                isCustomer
                  ? 'bg-accent/15 text-primary rounded-2xl rounded-br-md'
                  : 'bg-card border border-border-light text-primary rounded-2xl rounded-bl-md shadow-card'
              }`}>
                <p className="text-[10px] font-bold mb-0.5 text-text-tertiary">
                  {isCustomer ? 'You' : merchantName || ticket?.merchant_name || 'Merchant'}
                </p>
                <p className="text-[13px] whitespace-pre-wrap break-words leading-relaxed">{msg.body}</p>
                <p className="text-[9px] text-text-tertiary mt-1">
                  {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {ticket?.status !== 'closed' ? (
        <div className="px-4 py-3 border-t border-border-light/50 bg-card/95 backdrop-blur-md flex gap-2 flex-shrink-0" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
            placeholder="Type a message..." className="flex-1 input-field" disabled={sending} />
          <button onClick={handleSendReply} disabled={sending || !replyText.trim()}
            className="w-10 h-10 rounded-full bg-accent text-black flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="px-4 py-3 border-t border-border-light bg-surface text-center flex-shrink-0">
          <p className="text-xs text-text-secondary">This conversation is closed</p>
          <button onClick={() => { setTicket(null); setMessages([]); setShowForm(true); }}
            className="text-xs text-accent font-semibold mt-1">
            Start new conversation
          </button>
        </div>
      )}
    </div>
  );
}
