
import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Plus, ChevronLeft, Loader2, Phone } from 'lucide-react';
import { supportAPI } from '../../../services/supportApi';
import { useAuth } from '../../../hooks/useAuth';
import toast from 'react-hot-toast';
import { PRODUCT_DISPLAY_NAME } from '../../../config/productIdentity';


const SupportWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState('list'); // 'list', 'create', 'chat'
    const [tickets, setTickets] = useState([]);
    const [activeTicket, setActiveTicket] = useState(null);
    const [loading, setLoading] = useState(false);
    const [newMessage, setNewMessage] = useState('');

    // Create Form State
    const [subject, setSubject] = useState('');
    const [priority, setPriority] = useState('MEDIUM');
    const [initialMessage, setInitialMessage] = useState('');
    const [guestName, setGuestName] = useState('');
    const [guestEmail, setGuestEmail] = useState('');

    const { isAuthenticated } = useAuth();
    const isGuest = !isAuthenticated;
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [activeTicket?.messages]);

    useEffect(() => {
        if (isOpen && !isGuest) {
            fetchTickets();
        } else if (isOpen && isGuest) {
            setView('create');
        }
    }, [isOpen, isGuest]);



    const fetchTickets = async () => {
        try {
            setLoading(true);
            const data = await supportAPI.getTickets();
            setTickets(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTicket = async (e) => {
        e.preventDefault();
        if (!subject || !initialMessage) return;
        try {
            setLoading(true);
            const data = { subject, priority: isGuest ? 'MEDIUM' : priority, message: initialMessage };
            if (isGuest) {
                if (!guestName || !guestEmail) {
                    toast.error("Please provide your name and email");
                    return;
                }
                data.guestName = guestName;
                data.guestEmail = guestEmail;
            }
            const newTicket = await supportAPI.createTicket(data);
            if (isGuest) {
                toast.success('Message sent! We\'ll be in touch.');
                setIsOpen(false);
                setSubject('');
                setInitialMessage('');
                setGuestName('');
                setGuestEmail('');
                return;
            }
            setTickets([newTicket, ...tickets]);
            openChat(newTicket.id);
            setSubject('');
            setPriority('MEDIUM');
            setInitialMessage('');
            toast.success('Ticket created');
        } catch (error) {
            toast.error('Failed to create ticket');
        } finally {
            setLoading(false);
        }
    };

    const openChat = async (ticketId) => {
        try {
            setLoading(true);
            const ticket = await supportAPI.getTicket(ticketId);
            setActiveTicket(ticket);
            setView('chat');
        } catch (error) {
            toast.error('Failed to load ticket');
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeTicket) return;
        try {
            await supportAPI.addMessage(activeTicket.id, newMessage);
            setNewMessage('');
        } catch (error) {
            toast.error('Failed to send');
        }
    };

    const leaveChat = () => {
        setActiveTicket(null);
        setView('list');
        fetchTickets();
    };


    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-8 right-8 h-16 w-16 bg-[#14B8A6] hover:bg-[#0F9A8A] text-white rounded-2xl shadow-2xl flex items-center justify-center transition-all z-50 hover:scale-110 active:scale-95 group"
            >
                <span className="absolute inline-flex h-full w-full rounded-2xl bg-teal-400 opacity-20 animate-ping group-hover:animate-none"></span>
                <MessageCircle size={30} className="relative z-10" strokeWidth={2.5} />
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 w-[400px] h-[600px] bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col z-50 border border-slate-100 animate-in slide-in-from-bottom-10 fade-in duration-300">
            {/* Header */}
            <div className="bg-[#14B8A6] p-6 text-white flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    {view !== 'list' && !isGuest && (
                        <button onClick={view === 'chat' ? leaveChat : () => setView('list')} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                            <ChevronLeft size={20} />
                        </button>
                    )}
                    <div>
                        <h3 className="font-medium text-xl">{isGuest ? `${PRODUCT_DISPLAY_NAME} Support` : 'Support Details'}</h3>
                        <p className="text-teal-50 text-xs opacity-80">Typically replies in minutes</p>
                    </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                    <X size={20} />
                </button>
            </div>

            {/* Content Area with hidden scrollbars */}
            <div
                className="flex-1 overflow-y-auto bg-gray-50 p-6"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
                <div className="hide-scrollbar h-full">
                    {/* LIST VIEW */}
                    {view === 'list' && (
                        <div className="space-y-4">
                            <button
                                onClick={() => setView('create')}
                                className="w-full bg-[#14B8A6] text-white py-4 px-6 rounded-2xl shadow-lg shadow-teal-100 hover:bg-[#0F9A8A] transition-all flex items-center justify-center gap-3 font-medium group"
                            >
                                <Plus size={20} className="group-hover:rotate-90 transition-transform" /> Start New Conversation
                            </button>

                            {loading && tickets.length === 0 ? (
                                <div className="flex justify-center p-12"><Loader2 className="animate-spin text-teal-500" size={32} /></div>
                            ) : (
                                <div className="space-y-3">
                                    {tickets.length === 0 ? (
                                        <div className="text-center py-12">
                                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                                                <MessageCircle size={32} />
                                            </div>
                                            <p className="text-gray-500 font-medium">No active conversations</p>
                                        </div>
                                    ) : (
                                        tickets.map(ticket => (
                                            <div key={ticket.id} onClick={() => openChat(ticket.id)} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className={`text-[10px] px-2 py-1 rounded-full font-medium uppercase tracking-wider ${ticket.status === 'OPEN' ? 'bg-teal-50 text-teal-600' :
                                                        ticket.status === 'RESOLVED' ? 'bg-blue-50 text-blue-600' :
                                                            'bg-gray-50 text-gray-600'
                                                        }`}>
                                                        {ticket.status}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 font-medium">
                                                        {new Date(ticket.updatedAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <h4 className="font-medium text-gray-800 truncate group-hover:text-[#14B8A6] transition-colors">{ticket.subject}</h4>
                                                <p className="text-xs text-gray-500 truncate mt-1">
                                                    {ticket._count?.messages || 0} messages • Click to open
                                                </p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* CREATE VIEW */}
                    {view === 'create' && (
                        <form onSubmit={handleCreateTicket} className="space-y-4">
                            {isGuest && (
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500 ml-1">YOUR NAME</label>
                                        <input
                                            type="text"
                                            value={guestName}
                                            onChange={e => setGuestName(e.target.value)}
                                            className="w-full px-5 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-teal-50 focus:border-[#14B8A6] outline-none transition-all"
                                            placeholder="Jane Smith"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500 ml-1">EMAIL ADDRESS</label>
                                        <input
                                            type="email"
                                            value={guestEmail}
                                            onChange={e => setGuestEmail(e.target.value)}
                                            className="w-full px-5 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-teal-50 focus:border-[#14B8A6] outline-none transition-all"
                                            placeholder="jane@school.com"
                                            required
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500 ml-1">SUBJECT</label>
                                <input
                                    type="text"
                                    value={subject}
                                    onChange={e => setSubject(e.target.value)}
                                    className="w-full px-5 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-teal-50 focus:border-[#14B8A6] outline-none transition-all"
                                    placeholder="How can we help?"
                                    required
                                />
                            </div>

                            {!isGuest && (
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500 ml-1">PRIORITY</label>
                                    <select
                                        value={priority}
                                        onChange={e => setPriority(e.target.value)}
                                        className="w-full px-5 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-teal-50 focus:border-[#14B8A6] outline-none transition-all appearance-none"
                                    >
                                        <option value="LOW">General Inquiry</option>
                                        <option value="MEDIUM">Setup / Account</option>
                                        <option value="HIGH">Feature Request</option>
                                        <option value="CRITICAL">Technical Issue</option>
                                    </select>
                                </div>
                            )}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500 ml-1">MESSAGE</label>
                                <textarea
                                    value={initialMessage}
                                    onChange={e => setInitialMessage(e.target.value)}
                                    className="w-full px-5 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-teal-50 focus:border-[#14B8A6] outline-none transition-all min-h-[120px] resize-none"
                                    placeholder="Tell us more context..."
                                    required
                                />
                            </div>
                            <button
                                disabled={loading}
                                type="submit"
                                className="w-full bg-[#14B8A6] text-white py-4 rounded-2xl shadow-lg shadow-teal-50 hover:bg-[#0F9A8A] transition-all flex items-center justify-center gap-2 font-medium mt-2"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : (isGuest ? 'Send Message' : 'Submit Ticket')}
                            </button>
                        </form>
                    )}

                    {/* CHAT VIEW */}
                    {view === 'chat' && activeTicket && (
                        <div className="flex flex-col h-full">
                            <div className="flex-1 space-y-4 pb-4">
                                {activeTicket.messages?.map((msg) => {
                                    const isMe = msg.senderId === JSON.parse(localStorage.getItem('user') || '{}').id;
                                    return (
                                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${isMe
                                                ? 'bg-[#14B8A6] text-white rounded-br-none'
                                                : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                                                }`}>
                                                <p className="text-sm leading-relaxed">{msg.message}</p>
                                                <span className={`text-[9px] font-medium block mt-2 uppercase tracking-tighter ${isMe ? 'text-teal-100' : 'text-gray-400'}`}>
                                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Input Bar (Visible only in chat view) */}
            {view === 'chat' && (
                <div className="p-4 bg-white border-t border-gray-100">
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={e => setNewMessage(e.target.value)}
                            className="flex-1 px-5 py-3 bg-gray-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500 border-none text-sm"
                            placeholder="Shift + Enter for new line..."
                        />
                        <button type="submit" className="p-3 bg-[#14B8A6] text-white rounded-2xl hover:bg-[#0F9A8A] transition-all shadow-md active:scale-95">
                            <Send size={20} />
                        </button>
                    </form>
                </div>
            )}
        </div >
    );
};


export default SupportWidget;
