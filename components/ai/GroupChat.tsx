'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { supabase } from '@/lib/supabase/client';
import { useChat } from '@/lib/hooks/useChat';
import { createPlace } from '@/lib/supabase/client';

interface Message {
  id: string;
  user_id: string | null;
  content: string;
  role: 'user' | 'assistant' | 'system';
  created_at: string;
  profiles?: {
    id: string;
    full_name: string;
    email: string;
  };
}

interface GroupChatProps {
  tripId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function GroupChat({ tripId, isOpen, onClose }: GroupChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: `/api/trips/${tripId}/chat`,
    onFinish: async (message: { content: string; toolInvocations?: Array<{ toolName: string; result?: { results?: Array<{ name: string; lat: number; lng: number; category?: string }> } }> }) => {
      console.log('GroupChat onFinish called with:', {
        contentLength: message.content?.length,
        hasToolInvocations: !!message.toolInvocations,
        toolInvocationsCount: message.toolInvocations?.length || 0,
        fullMessage: message,
      });

      // AI message is already saved by the API route, just reload to show it
      await loadMessages();

      // Check for tool calls (place additions)
      if (message.toolInvocations && Array.isArray(message.toolInvocations)) {
        console.log('Processing tool invocations:', message.toolInvocations.length);
        for (const invocation of message.toolInvocations) {
          console.log('Processing invocation:', invocation.toolName, 'Result:', invocation.result);
          if (invocation.toolName === 'search_places') {
            console.log('Found search_places invocation, result structure:', JSON.stringify(invocation.result, null, 2));
            // The result should have a 'results' array
            let results: Array<{ name: string; lat: number; lng: number; category?: string }> = [];
            
            if (invocation.result?.results && Array.isArray(invocation.result.results)) {
              results = invocation.result.results;
            } else if (Array.isArray(invocation.result)) {
              results = invocation.result;
            }
            
            console.log('Places to add:', results.length);
            console.log('First place sample:', results[0] ? JSON.stringify(results[0], null, 2) : 'none');
            
            if (results.length > 0) {
              // Auto-add places to map
              for (const place of results.slice(0, 3)) {
                // Validate place data before creating
                if (!place || typeof place !== 'object') {
                  console.error('Invalid place data:', place);
                  continue;
                }
                
                const placeName = place.name || 'Unknown Place';
                const placeLat = typeof place.lat === 'number' ? place.lat : 0;
                const placeLng = typeof place.lng === 'number' ? place.lng : 0;
                
                if (!placeName || placeName === 'undefined' || placeName === 'Unknown Place') {
                  console.error('Invalid place name:', placeName, 'Full place data:', JSON.stringify(place, null, 2));
                  continue;
                }
                
                if (placeLat === 0 && placeLng === 0) {
                  console.error('Invalid coordinates:', placeLat, placeLng, 'Full place data:', JSON.stringify(place, null, 2));
                  continue;
                }
                
                // Map category to database-allowed values
                const mapCategory = (cat: string | undefined): string => {
                  if (!cat) return 'other';
                  const normalized = cat.toLowerCase();
                  
                  // Allowed categories: 'restaurant', 'attraction', 'hotel', 'shopping', 'transport', 'other'
                  if (normalized.includes('restaurant') || normalized.includes('cafe') || 
                      normalized.includes('coffee') || normalized.includes('bar') ||
                      normalized.includes('food') || normalized.includes('dining')) {
                    return 'restaurant';
                  }
                  if (normalized.includes('hotel') || normalized.includes('lodging')) {
                    return 'hotel';
                  }
                  if (normalized.includes('store') || normalized.includes('shop') || normalized.includes('shopping')) {
                    return 'shopping';
                  }
                  if (normalized.includes('station') || normalized.includes('transport')) {
                    return 'transport';
                  }
                  if (normalized.includes('museum') || normalized.includes('park') || 
                      normalized.includes('attraction') || normalized.includes('landmark')) {
                    return 'attraction';
                  }
                  return 'other';
                };
                
                const mappedCategory = mapCategory(place.category);
                console.log('Adding place:', placeName, placeLat, placeLng, 'Category:', place.category, '-> Mapped:', mappedCategory);
                try {
                  const { data: createdPlace, error: createError } = await createPlace({
                    trip_id: tripId,
                    name: placeName,
                    lat: placeLat,
                    lng: placeLng,
                    category: mappedCategory,
                    created_by: user?.id || null,
                  });
                  
                  if (createError) {
                    console.error('Failed to create place:', createError);
                  } else {
                    console.log('Place created successfully:', createdPlace ? (createdPlace as any).name : 'unknown');
                  }
                } catch (error) {
                  console.error('Error creating place:', error);
                }
              }
            } else {
              console.warn('No results to add, results array:', results);
            }
          }
        }
      } else {
        console.log('No tool invocations found');
      }
    },
  });

  useEffect(() => {
    if (!isOpen) return;

    loadMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`trip-messages:${tripId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trip_messages',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          loadMessageWithProfile(payload.new as Message);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [isOpen, tripId]);

  async function loadMessages() {
    setLoading(true);
    
    // Check session first
    const { data: { session } } = await supabase.auth.getSession();
    console.log('GroupChat: Session exists:', !!session);
    console.log('GroupChat: User ID:', user?.id);
    
    // Load messages without join first to avoid issues with NULL user_id
    const { data: messagesData, error: messagesError } = await supabase
      .from('trip_messages')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error loading messages:', messagesError);
      console.error('Error code:', messagesError.code);
      console.error('Error message:', messagesError.message);
      console.error('Error details:', JSON.stringify(messagesError, null, 2));
      setMessages([]);
      setLoading(false);
      return;
    }

    if (!messagesData || messagesData.length === 0) {
      setMessages([]);
      setLoading(false);
      return;
    }

    // Get unique user IDs (excluding NULL for AI messages)
    const userIds = [...new Set(messagesData.map((m: any) => m.user_id).filter(Boolean))];
    
    // Load profiles for users
    let profilesMap = new Map();
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      
      if (profilesData) {
        profilesMap = new Map(profilesData.map((p: any) => [p.id, p]));
      }
    }

    // Combine messages with profiles
    const messagesWithProfiles = messagesData.map((msg: any) => ({
      ...msg,
      profiles: msg.user_id ? profilesMap.get(msg.user_id) : undefined,
    }));

    setMessages(messagesWithProfiles);
    setLoading(false);
    scrollToBottom();
  }

  async function loadMessageWithProfile(message: Message) {
    // Check if message already exists to avoid duplicates
    if (messages.some(m => m.id === message.id)) {
      return;
    }
    
    if (message.user_id) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', message.user_id)
        .single();

      if (profileError) {
        console.error('Error loading profile:', profileError);
      } else {
        message.profiles = profile || undefined;
      }
    }
    setMessages((prev) => [...prev, message]);
    scrollToBottom();
  }

  function scrollToBottom() {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !user) return;

    const messageContent = input.trim();
    const aiTrigger = 'hey trippee';
    const isAiRequest = messageContent.toLowerCase().startsWith(aiTrigger);

    if (isAiRequest) {
      // AI request - use the chat API
      handleSubmit(e);
      
      // Reload messages after a delay to show the user message
      setTimeout(async () => {
        await loadMessages();
      }, 1000);
    } else {
      // Normal group chat message - save directly to database
      const { error } = await supabase.from('trip_messages').insert({
        trip_id: tripId,
        user_id: user.id,
        content: messageContent,
        role: 'user',
      } as any);

      if (error) {
        console.error('Failed to save message:', error);
        alert('Failed to send message. Please try again.');
      } else {
        // Clear input using the useChat hook's input state
        handleInputChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>);
        await loadMessages();
      }
    }
  }

  function getSenderName(message: Message): string {
    if (message.role === 'assistant') return 'AI Assistant';
    if (message.profiles?.full_name) return message.profiles.full_name;
    if (message.profiles?.email) return message.profiles.email.split('@')[0];
    return 'Unknown User';
  }

  function getSenderInitials(message: Message): string {
    if (message.role === 'assistant') return 'AI';
    const name = getSenderName(message);
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg text-gray-900">Trip Chat</h2>
          <p className="text-sm text-gray-900">Collaborate with your group</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-900 hover:text-gray-900"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="text-center text-gray-900">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-900">
            <p className="mb-2">Start the conversation!</p>
            <p className="text-sm">Ask the AI assistant for place recommendations.</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.user_id === user?.id ? 'flex-row-reverse' : ''
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                  message.role === 'assistant'
                    ? 'bg-purple-500 text-white'
                    : 'bg-blue-500 text-white'
                }`}
              >
                {getSenderInitials(message)}
              </div>

              {/* Message Content */}
              <div className={`flex-1 ${message.user_id === user?.id ? 'items-end' : ''}`}>
                <div className="text-xs text-gray-900 mb-1">
                  {getSenderName(message)}
                </div>
                <div
                  className={`rounded-lg p-3 ${
                    message.role === 'assistant'
                      ? 'bg-purple-50 border border-purple-200'
                      : message.user_id === user?.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100'
                  }`}
                >
                  <p className={`whitespace-pre-wrap ${
                    message.role === 'assistant'
                      ? 'text-gray-900'
                      : message.user_id === user?.id
                      ? 'text-white'
                      : 'text-gray-900'
                  }`}>{message.content}</p>
                </div>
                <div className="text-xs text-gray-900 mt-1">
                  {new Date(message.created_at).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-semibold">
              AI
            </div>
            <div className="flex-1">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t">
        <p className="text-xs text-gray-900 mb-2">
          Say <span className="font-semibold">"Hey Trippee"</span> to ask the AI assistant
        </p>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="flex-1 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-700"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}