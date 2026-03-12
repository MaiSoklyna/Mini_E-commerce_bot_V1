"use client";
import { useState, useEffect, useRef } from "react";
import * as supportService from "@/services/supportService";
import { SupportTicket, TicketMessage } from "@/types";
import { MdChat, MdClose, MdSend, MdRefresh } from "react-icons/md";

const statusStyles: Record<string, { bg: string; color: string; label: string }> = {
  open: { bg: "var(--warning)", color: "#fff", label: "Open" },
  replied: { bg: "var(--accent)", color: "#000", label: "Replied" },
  closed: { bg: "var(--text-muted)", color: "#fff", label: "Closed" },
};

function timeAgo(dateStr?: string) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [ticketDetail, setTicketDetail] = useState<any>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [total, setTotal] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const res = await supportService.listTickets({
        limit: 50, status: filterStatus || undefined, search: search || undefined,
      });
      setTickets(res.data || []);
      setTotal(res.meta?.total || 0);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const loadMessages = async (ticketId: number) => {
    setMsgLoading(true);
    try {
      const data = await supportService.getTicket(ticketId);
      setTicketDetail(data);
      setMessages(data.messages || []);
    } catch (e) {
      console.error(e);
    }
    setMsgLoading(false);
  };

  useEffect(() => {
    loadTickets();
  }, [filterStatus]);

  useEffect(() => {
    if (selected) loadMessages(selected);
  }, [selected]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    setSending(true);
    try {
      await supportService.replyToTicket(selected, reply);
      setReply("");
      await loadMessages(selected);
      loadTickets();
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to send reply");
    }
    setSending(false);
  };

  const closeTicket = async () => {
    if (!selected || !confirm("Close this ticket?")) return;
    try {
      await supportService.closeTicket(selected);
      await loadTickets();
      await loadMessages(selected);
    } catch (e: any) {
      alert(e.response?.data?.detail || "Error");
    }
  };

  const openCount = tickets.filter((t) => t.status === "open").length;

  return (
    <div className="animate-in" style={{ height: "calc(100vh - 94px)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
            Support Inbox
          </h1>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {total} tickets
            {openCount > 0 && (
              <span
                className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: "var(--warning)", color: "#fff" }}
              >
                {openCount} open
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-1">
          {["", "open", "replied", "closed"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize"
              style={{
                background: filterStatus === s ? "var(--accent)" : "var(--bg-secondary)",
                color: filterStatus === s ? "var(--bg)" : "var(--text-secondary)",
                border: `1px solid ${filterStatus === s ? "var(--accent)" : "var(--border)"}`,
              }}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by subject or customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && loadTickets()}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--bg-secondary)",
            color: "var(--text)",
            fontSize: 13,
            outline: "none",
          }}
        />
      </div>

      {/* Main content: list + conversation */}
      <div style={{ flex: 1, display: "flex", gap: 16, minHeight: 0 }}>
        {/* Ticket list */}
        <div
          style={{
            width: selected ? 340 : "100%",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--bg-secondary)",
            overflow: "auto",
            flexShrink: 0,
            transition: "width 0.2s",
          }}
        >
          {loading ? (
            <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
              Loading...
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
              <MdChat size={40} style={{ margin: "0 auto 8px", display: "block", opacity: 0.3 }} />
              <p className="text-sm">No tickets found</p>
            </div>
          ) : (
            tickets.map((t) => {
              const st = statusStyles[t.status] || statusStyles.open;
              const isSelected = selected === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelected(t.id)}
                  style={{
                    width: "100%",
                    display: "block",
                    textAlign: "left",
                    padding: "12px 14px",
                    borderBottom: "1px solid var(--border)",
                    background: isSelected ? "var(--accent-light)" : "transparent",
                    cursor: "pointer",
                    border: "none",
                    borderBottomStyle: "solid",
                    borderBottomWidth: 1,
                    borderBottomColor: "var(--border)",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "var(--bg-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div className="flex items-start justify-between mb-1">
                    <p
                      className="text-sm font-semibold truncate"
                      style={{ color: "var(--text)", maxWidth: 200 }}
                    >
                      {t.subject}
                    </p>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ml-2"
                      style={{ background: st.bg, color: st.color }}
                    >
                      {st.label}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {t.customer_name || t.customer_username || "Customer"}{" "}
                    {t.message_count ? `· ${t.message_count} msgs` : ""}
                  </p>
                  {t.last_message && (
                    <p
                      className="text-xs mt-1 truncate"
                      style={{ color: "var(--text-secondary)", maxWidth: 280 }}
                    >
                      {t.last_message}
                    </p>
                  )}
                  <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                    {timeAgo(t.updated_at || t.created_at)}
                  </p>
                </button>
              );
            })
          )}
        </div>

        {/* Conversation panel */}
        {selected && (
          <div
            style={{
              flex: 1,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--bg-secondary)",
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
            }}
          >
            {/* Conversation header */}
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p className="text-sm font-bold truncate" style={{ color: "var(--text)" }}>
                  {ticketDetail?.subject || "Loading..."}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {ticketDetail?.customer_name || ticketDetail?.customer_username || "Customer"}
                  {ticketDetail?.order_id && ` · Order #${ticketDetail.order_id}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {ticketDetail?.status !== "closed" && (
                  <button onClick={closeTicket} className="btn btn-outline" style={{ fontSize: 11 }}>
                    <MdClose size={14} style={{ marginRight: 4 }} />
                    Close
                  </button>
                )}
                <button
                  onClick={() => loadMessages(selected)}
                  className="btn btn-outline"
                  style={{ fontSize: 11, padding: "6px 8px" }}
                  title="Refresh"
                >
                  <MdRefresh size={16} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
              {msgLoading ? (
                <div className="text-center py-8" style={{ color: "var(--text-muted)" }}>
                  Loading messages...
                </div>
              ) : (
                messages.map((msg) => {
                  const isCustomer = msg.sender_type === "customer";
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: "flex",
                        justifyContent: isCustomer ? "flex-start" : "flex-end",
                        marginBottom: 12,
                      }}
                    >
                      <div
                        style={{
                          maxWidth: "75%",
                          padding: "10px 14px",
                          borderRadius: 12,
                          background: isCustomer ? "var(--bg)" : "var(--accent)",
                          color: isCustomer ? "var(--text)" : "#000",
                          border: isCustomer ? "1px solid var(--border)" : "none",
                        }}
                      >
                        <p className="text-[10px] font-semibold mb-1" style={{ opacity: 0.7 }}>
                          {isCustomer ? "Customer" : "You"}
                        </p>
                        <p className="text-sm" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {msg.body}
                        </p>
                        <p className="text-[10px] mt-1" style={{ opacity: 0.5 }}>
                          {msg.created_at
                            ? new Date(msg.created_at).toLocaleString()
                            : ""}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply input */}
            {ticketDetail?.status !== "closed" ? (
              <div
                style={{
                  padding: "12px 16px",
                  borderTop: "1px solid var(--border)",
                  display: "flex",
                  gap: 8,
                  flexShrink: 0,
                }}
              >
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type your reply..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    color: "var(--text)",
                    fontSize: 13,
                    resize: "none",
                    outline: "none",
                    minHeight: 40,
                    maxHeight: 100,
                  }}
                  rows={1}
                />
                <button
                  onClick={sendReply}
                  disabled={sending || !reply.trim()}
                  className="btn btn-primary"
                  style={{ padding: "8px 16px", display: "flex", alignItems: "center", gap: 4 }}
                >
                  <MdSend size={16} />
                  {sending ? "..." : "Send"}
                </button>
              </div>
            ) : (
              <div
                style={{
                  padding: "12px 16px",
                  borderTop: "1px solid var(--border)",
                  textAlign: "center",
                  flexShrink: 0,
                }}
              >
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  This ticket is closed
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
