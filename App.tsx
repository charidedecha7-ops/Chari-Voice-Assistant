import React, { useState, useEffect, useCallback } from 'react';
import { startConversation, stopConversation } from './services/geminiService';
import { ConversationMessage, SessionStatus } from './types';
import ConversationUI from './components/ConversationUI';

const App: React.FC = () => {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [status, setStatus] = useState<SessionStatus>(SessionStatus.IDLE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleNewMessage = useCallback((message: ConversationMessage) => {
    setMessages((prevMessages) => [...prevMessages, message]);
    if (message.sender === 'status' && message.text.startsWith('Error:')) {
      setErrorMessage(message.text);
    } else if (message.sender !== 'status' && errorMessage) {
      setErrorMessage(null); // Clear error message if user or assistant message comes through
    }
  }, [errorMessage]);

  const handleStatusChange = useCallback((newStatus: SessionStatus) => {
    setStatus(newStatus);
    if (newStatus === SessionStatus.ERROR) {
      // Error message should already be set by handleNewMessage or directly by onError
    } else if (newStatus === SessionStatus.IDLE && errorMessage) {
      setErrorMessage(null); // Clear error if successfully back to idle after an error was shown
    }
  }, [errorMessage]);

  const handleError = useCallback((error: string) => {
    setErrorMessage(error);
    setStatus(SessionStatus.ERROR);
    handleNewMessage({ id: Date.now().toString(), sender: 'status', text: `Error: ${error}`, timestamp: new Date().toLocaleTimeString() });
  }, [handleNewMessage]);

  const handleStart = useCallback(() => {
    setMessages([]); // Clear previous messages
    setErrorMessage(null); // Clear any previous errors
    startConversation({
      onMessage: handleNewMessage,
      onStatusChange: handleStatusChange,
      onError: handleError,
    });
  }, [handleNewMessage, handleStatusChange, handleError]);

  const handleStop = useCallback(() => {
    setStatus(SessionStatus.CLOSING);
    stopConversation();
  }, []);

  // Ensure conversation is stopped on unmount
  useEffect(() => {
    return () => {
      stopConversation();
    };
  }, []);

  return (
    <ConversationUI
      messages={messages}
      status={status}
      onStart={handleStart}
      onStop={handleStop}
      errorMessage={errorMessage}
    />
  );
};

export default App;