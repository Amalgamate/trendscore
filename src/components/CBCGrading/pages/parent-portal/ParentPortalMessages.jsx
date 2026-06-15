/**
 * Parent Portal Messages Screen
 * Modern chat inbox interface for school-parent communication
 * Display conversations with School, Class Teacher, Finance, Transport, etc.
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, MessageSquare, Search, Send, Phone, Mail,
  ChevronRight, MoreVertical, AlertCircle, Users, Clock,
  Paperclip, Smile
} from 'lucide-react';
import { dashboardAPI } from '../../../../services/api';

// ─── Helper Components ──────────────────────────────────────────────

function ConversationItem({ conversation, isSelected, onClick }) {
  const unreadCount = conversation.unreadCount || 0;
  const hasUnread = unreadCount > 0;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 p-3 rounded-xl transition ${
        isSelected
          ? 'bg-brand-purple/10 border border-brand-purple'
          : 'bg-white border border-gray-200 hover:bg-gray-50'
      }`}
    >
      {/* Avatar */}
      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white ${
        conversation.color || 'bg-brand-purple'
      }`}>
        {conversation.avatar || conversation.name?.[0] || '?'}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className={`font-semibold text-sm ${hasUnread ? 'text-gray-900' : 'text-gray-700'}`}>
            {conversation.name}
          </h3>
          {hasUnread && (
            <span className="flex-shrink-0 w-5 h-5 bg-red-500 text-white rounded-full text-xs font-bold flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </div>
        <p className={`text-xs truncate mt-0.5 ${hasUnread ? 'text-gray-600 font-medium' : 'text-gray-500'}`}>
          {conversation.lastMessage || 'No messages yet'}
        </p>
        <p className="text-[10px] text-gray-400 mt-1">{conversation.timestamp || 'Recently'}</p>
      </div>

      <ChevronRight size={16} className="flex-shrink-0 text-gray-300 mt-1" />
    </button>
  );
}

function MessageBubble({ message, isSent }) {
  return (
    <div className={`flex gap-2 mb-3 ${isSent ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      {!isSent && (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-xs font-bold">
          {message.senderInitial || 'S'}
        </div>
      )}

      {/* Message */}
      <div className={`flex-1 max-w-xs ${isSent ? 'text-right' : ''}`}>
        <div className={`px-4 py-2.5 rounded-2xl ${
          isSent
            ? 'bg-brand-purple text-white rounded-br-none'
            : 'bg-gray-100 text-gray-900 rounded-bl-none'
        }`}>
          <p className="text-sm break-words">{message.text}</p>
        </div>
        <p className={`text-[10px] text-gray-500 mt-1 ${isSent ? 'text-right' : ''}`}>
          {message.time || 'Now'}
        </p>
      </div>
    </div>
  );
}

function ChatWindow({ conversation, onClose, onSendMessage }) {
  const [messageText, setMessageText] = useState('');
  const messages = conversation?.messages || [
    {
      id: 1,
      text: 'Hello, I wanted to check on my child\'s progress.',
      isSent: true,
      time: '10:30 AM',
      senderInitial: 'P'
    },
    {
      id: 2,
      text: 'Your child is doing well in class. Keep up the communication.',
      isSent: false,
      time: '10:35 AM',
      senderInitial: 'T'
    }
  ];

  const handleSend = () => {
    if (messageText.trim()) {
      onSendMessage(messageText);
      setMessageText('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="bg-white w-full h-full sm:h-auto sm:rounded-3xl sm:max-w-md flex flex-col animate-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">{conversation?.name}</h3>
            <p className="text-xs text-gray-500">Active now</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600"
          >
            <ArrowLeft size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} isSent={msg.isSent} />
          ))}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-gray-200 rounded-lg transition text-gray-600">
              <Paperclip size={18} />
            </button>
            <input
              type="text"
              placeholder="Type a message..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              className="flex-1 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple"
            />
            <button className="p-2 hover:bg-gray-200 rounded-lg transition text-gray-600">
              <Smile size={18} />
            </button>
            <button
              onClick={handleSend}
              className="p-2 bg-brand-purple hover:bg-purple-700 rounded-lg transition text-white"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

const ParentPortalMessages = ({ user, onNavigate }) => {
  const [conversations, setConversations] = useState([
    {
      id: 1,
      name: 'School Administration',
      avatar: '🏫',
      color: 'bg-blue-500',
      lastMessage: 'School will resume on Monday, January 15th',
      timestamp: '2 hours ago',
      unreadCount: 0,
    },
    {
      id: 2,
      name: 'Class Teacher - Ms. Kariuki',
      avatar: 'K',
      color: 'bg-emerald-500',
      lastMessage: 'John did great on the math test! 👏',
      timestamp: '1 day ago',
      unreadCount: 1,
    },
    {
      id: 3,
      name: 'Finance Office',
      avatar: '💰',
      color: 'bg-amber-500',
      lastMessage: 'Payment reminder: KES 15,000 due by Jan 20',
      timestamp: '3 days ago',
      unreadCount: 0,
    },
    {
      id: 4,
      name: 'Transport Office',
      avatar: '🚌',
      color: 'bg-purple-500',
      lastMessage: 'Route update: New pickup time at 7:15 AM',
      timestamp: '1 week ago',
      unreadCount: 0,
    },
  ]);

  const [selectedConversation, setSelectedConversation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load messages from API
    const loadMessages = async () => {
      try {
        setLoading(true);
        // const response = await dashboardAPI.getParentMessages?.();
        // if (response.success) {
        //   setConversations(response.data.conversations);
        // }
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        setLoading(false);
      }
    };
    loadMessages();
  }, []);

  const filteredConversations = conversations.filter((conv) =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSendMessage = (messageText) => {
    if (selectedConversation) {
      // Handle sending message - would call API
      console.log(`Sending to ${selectedConversation.name}: ${messageText}`);
      setSelectedConversation(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            onClick={() => onNavigate('parent-portal-home')}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition text-gray-600"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Messages</h1>
            <p className="text-xs text-gray-500">
              {conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0)} unread
            </p>
          </div>
          <div className="p-2 rounded-lg bg-violet-50 text-violet-600">
            <MessageSquare size={20} />
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-100 border-0 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple"
            />
          </div>
        </div>
      </div>

      {/* Conversations List */}
      <div className="px-4 py-4 space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-white rounded-xl border border-gray-200 animate-pulse" />
            ))}
          </div>
        ) : filteredConversations.length > 0 ? (
          <>
            {filteredConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isSelected={selectedConversation?.id === conversation.id}
                onClick={() => setSelectedConversation(conversation)}
              />
            ))}

            {/* Info Section */}
            <div className="mt-8 bg-violet-50 border border-violet-200 rounded-2xl p-4">
              <h3 className="font-semibold text-violet-900 mb-2">💬 Quick Messaging</h3>
              <p className="text-sm text-violet-800">
                Communicate directly with your child's school. Messages are typically answered within 24 hours during school days.
              </p>
            </div>

            {/* Contact Options */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">Other Ways to Contact</h3>
              <div className="space-y-2">
                <button className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition">
                  <Phone size={18} className="text-emerald-600" />
                  <div className="text-left text-sm flex-1">
                    <p className="font-semibold text-gray-900">Call School</p>
                    <p className="text-xs text-gray-500">+254 712 345 678</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-400" />
                </button>
                <button className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition">
                  <Mail size={18} className="text-blue-600" />
                  <div className="text-left text-sm flex-1">
                    <p className="font-semibold text-gray-900">Email School</p>
                    <p className="text-xs text-gray-500">info@school.ac.ke</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-400" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <MessageSquare size={40} className="mx-auto mb-3 text-gray-300" />
            <h3 className="font-semibold text-gray-900 mb-1">No conversations found</h3>
            <p className="text-sm text-gray-500">Try adjusting your search</p>
          </div>
        )}
      </div>

      {/* Chat Modal */}
      {selectedConversation && (
        <ChatWindow
          conversation={selectedConversation}
          onClose={() => setSelectedConversation(null)}
          onSendMessage={handleSendMessage}
        />
      )}
    </div>
  );
};

export default ParentPortalMessages;
