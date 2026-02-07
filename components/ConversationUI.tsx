import React, { useEffect, useRef } from 'react';
import { ConversationMessage, SessionStatus, ConversationUIProps } from '../types';

const ConversationUI: React.FC<ConversationUIProps> = ({ messages, status, onStart, onStop, errorMessage }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getStatusText = (currentStatus: SessionStatus) => {
    switch (currentStatus) {
      case SessionStatus.IDLE: return 'Idle';
      case SessionStatus.CONNECTING: return 'Connecting...';
      case SessionStatus.LISTENING: return 'Listening...';
      case SessionStatus.SPEAKING: return 'Speaking...';
      case SessionStatus.ERROR: return 'Error!';
      case SessionStatus.CLOSING: return 'Closing...';
      default: return 'Unknown Status';
    }
  };

  const isListeningOrSpeaking = status === SessionStatus.LISTENING || status === SessionStatus.SPEAKING;
  const isDisabled = status === SessionStatus.CONNECTING || status === SessionStatus.CLOSING;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-md z-10">
        <h1 className="text-2xl font-bold text-center">Chari Voice Assistant</h1>
      </div>

      {/* Assistant Image - Shows during conversation */}
      {isListeningOrSpeaking && (
        <div className="flex justify-center items-center p-4 bg-gradient-to-b from-gray-100 to-white">
          <div className="relative">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg border-4 border-blue-500 animate-pulse">
              <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
              </svg>
            </div>
            <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-2 shadow-lg">
              <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>
            </div>
          </div>
        </div>
      )}

      {/* Message Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.sender === 'user' ? 'justify-end' : msg.sender === 'assistant' ? 'justify-start' : 'justify-center'
            }`}
          >
            <div
              className={`max-w-75 px-4 py-2 rounded-lg shadow-sm text-sm ${
                msg.sender === 'user'
                  ? 'bg-blue-500 text-white'
                  : msg.sender === 'assistant'
                  ? 'bg-gray-200 text-gray-800'
                  : 'bg-yellow-100 text-yellow-800 italic text-center'
              }`}
            >
              <p>{msg.text}</p>
              <span className={`block text-xs mt-1 ${msg.sender === 'user' ? 'text-blue-200' : 'text-gray-500'}`}>
                {msg.timestamp}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-500 text-white p-3 text-center text-sm font-medium">
          {errorMessage}
        </div>
      )}

      {/* Footer / Control */}
      <div className="p-4 bg-gray-100 border-t border-gray-200 sticky bottom-0 z-10">
        {status !== SessionStatus.IDLE && (
          <div className="flex items-center justify-between mb-3">
            <span className={`text-sm font-medium ${
              status === SessionStatus.ERROR ? 'text-red-600' :
              status === SessionStatus.LISTENING ? 'text-green-600' :
              status === SessionStatus.SPEAKING ? 'text-purple-600' :
              'text-gray-600'
            }`}>
              Status: {getStatusText(status)}
            </span>
            {isListeningOrSpeaking && (
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </div>
            )}
          </div>
        )}

        {/* Voice Control Button */}
        <button
          onClick={isListeningOrSpeaking ? onStop : onStart}
          disabled={isDisabled}
          className={`w-full py-3 px-6 rounded-full text-lg font-semibold transition-all duration-300 ease-in-out
            ${isListeningOrSpeaking
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-green-500 hover:bg-green-600 text-white'}
            ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'shadow-lg'}
          `}
        >
          {isListeningOrSpeaking ? '🎤 Stop Voice Conversation' : '🎤 Start Voice Conversation'}
        </button>
      </div>
    </div>
  );
};

export default ConversationUI;