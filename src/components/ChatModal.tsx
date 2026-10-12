import React, { useState, useRef, useEffect } from 'react';
import { ChatChannel, ChatMessage, PlayerProfile } from '../types';
import { sound } from '../services/sound';
import { X, Send, Globe, Users, MessageSquare, ArrowUp, ArrowDown } from 'lucide-react';
import chatIconImg from '../assets/icons/chat_icon.png';

interface Props {
  player: PlayerProfile;
  messages: ChatMessage[];
  onSendMessage: (channel: ChatChannel, text: string) => void;
  onClose: () => void;
}

export const ChatModal: React.FC<Props> = ({ player, messages, onSendMessage, onClose }) => {
  const [activeChannel, setActiveChannel] = useState<ChatChannel>('world');
  const [inputText, setInputText] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const filteredMessages = messages.filter(m => m.channel === activeChannel);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [filteredMessages.length]);

  const scrollToTop = () => {
    sound.playClick();
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToBottom = () => {
    sound.playClick();
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputText.trim();
    if (!clean) return;

    sound.playClick();
    onSendMessage(activeChannel, clean);
    setInputText('');
  };

  const quickPhrases = [
    'Good luck in Phase 1 Speaking!',
    'Any tips for Band 7+ vocabulary?',
    'Looking for PvP Arena match!',
    'Just upgraded my Starmon!',
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-emerald-400/80 rounded-3xl p-4 md:p-6 max-w-2xl w-full shadow-2xl text-slate-100 flex flex-col justify-between max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-300 p-0.5 shadow-lg flex items-center justify-center">
              <img
                src={chatIconImg}
                alt="Chat Box"
                className="w-10 h-10 object-contain drop-shadow"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://www.dropbox.com/scl/fi/g27x2gjn3xeqpgd3lrztd/Chat_Icon.png?rlkey=ydpfymaadmozv17ht2vn3qlut&st=67ixilf1&raw=1';
                }}
              />
            </div>
            <div>
              <h3 className="text-xl font-black font-game text-white flex items-center gap-2">
                Trainer Comms & Chat
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-mono">
                  Online
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                World broadcasts, Clan strategy room, and private whisper channels.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Channels Navigation Tabs */}
        <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 mb-3 shrink-0">
          <button
            onClick={() => {
              sound.playClick();
              setActiveChannel('world');
            }}
            className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeChannel === 'world'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>World Chat</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveChannel('clan');
            }}
            className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeChannel === 'clan'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Clan Chat</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveChannel('private');
            }}
            className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeChannel === 'private'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Private Chat</span>
          </button>
        </div>

        {/* Message Thread Box with Dedicated Scroll Up & Down Controls */}
        <div className="relative flex-1 max-h-[48vh] flex flex-col">
          {/* Scroll Navigation Controls */}
          <div className="absolute top-2 right-4 z-20 flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 rounded-full p-1 shadow-lg backdrop-blur-sm">
            <button
              onClick={scrollToTop}
              className="p-1 rounded-full bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Scroll Up (Lên đầu trang)"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={scrollToBottom}
              className="p-1 rounded-full bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Scroll Down (Xuống cuối trang)"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>

          <div
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto space-y-2.5 p-3 rounded-2xl bg-slate-950/80 border border-slate-800 scroll-smooth"
          >
            {filteredMessages.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs">
                No messages in this channel yet. Say hello to fellow Trainers!
              </div>
            ) : (
              filteredMessages.map(msg => {
                const isMine = msg.isSelf || msg.senderName === (player.username || player.name);

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col text-xs ${
                      msg.isSystem
                        ? 'items-center text-center my-2'
                        : isMine
                        ? 'items-end'
                        : 'items-start'
                    }`}
                  >
                    {msg.isSystem ? (
                      <div className="px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700 text-slate-300 text-[11px] font-mono">
                        {msg.message}
                      </div>
                    ) : (
                      <div className="max-w-[85%]">
                        <div className={`flex items-center gap-1.5 mb-0.5 text-[10px] ${
                          isMine ? 'justify-end' : 'justify-start'
                        }`}>
                          <span className={`font-bold ${isMine ? 'text-amber-300' : 'text-sky-300'}`}>
                            {msg.senderName}
                          </span>
                          {msg.senderBadge && (
                            <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono text-[9px] border border-slate-700">
                              {msg.senderBadge}
                            </span>
                          )}
                          <span className="text-slate-500 font-mono">
                            {msg.timestamp}
                          </span>
                        </div>

                        <div
                          className={`p-2.5 rounded-2xl text-xs leading-relaxed shadow-md ${
                            isMine
                              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tr-none'
                              : 'bg-slate-900 text-slate-200 border border-slate-800 rounded-tl-none'
                          }`}
                        >
                          {msg.message}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quick Responses Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-2 shrink-0">
          {quickPhrases.map((phrase, pIdx) => (
            <button
              key={pIdx}
              onClick={() => {
                sound.playClick();
                onSendMessage(activeChannel, phrase);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-[11px] text-slate-300 whitespace-nowrap cursor-pointer transition-colors active:scale-95"
            >
              {phrase}
            </button>
          ))}
        </div>

        {/* Message Input Box */}
        <form onSubmit={handleSend} className="flex items-center gap-2 pt-1 shrink-0">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Message ${activeChannel === 'world' ? 'everyone' : activeChannel === 'clan' ? 'clan members' : 'private channel'}...`}
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-emerald-400 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition-colors"
          />
          <button
            type="submit"
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black font-game text-xs rounded-xl shadow-md cursor-pointer transition-transform active:scale-95 flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>SEND</span>
          </button>
        </form>
      </div>
    </div>
  );
};
