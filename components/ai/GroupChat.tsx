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
    onFinish: async (message: { content: string; toolInvocations?: Array<{ toolName: string; result?: { results?: Array<{ id?: string; name: string; lat: number; lng: number; category?: string }> } }> }) => {
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
            
            const toolResult = invocation.result;
            const results = toolResult?.results || toolResult?.allResults || [];
            const requestedLimit = toolResult?.requestedLimit || results.length;
            
            if (results.length === 0) return;
            
            // Map category to database-allowed values
            const mapCategory = (cat: string | undefined): string => {
              if (!cat) return 'other';
              const normalized = cat.toLowerCase();
              if (normalized.includes('restaurant') || normalized.includes('cafe') || 
                  normalized.includes('coffee') || normalized.includes('bar') ||
                  normalized.includes('food') || normalized.includes('dining')) return 'restaurant';
              if (normalized.includes('hotel') || normalized.includes('lodging')) return 'hotel';
              if (normalized.includes('store') || normalized.includes('shop') || normalized.includes('shopping')) return 'shopping';
              if (normalized.includes('station') || normalized.includes('transport')) return 'transport';
              if (normalized.includes('museum') || normalized.includes('park') || 
                  normalized.includes('attraction') || normalized.includes('landmark')) return 'attraction';
              return 'other';
            };
            
            // Fetch existing places for duplicate checking
            const { data: existingPlaces } = await supabase
              .from('places')
              .select('name, lat, lng, place_id')
              .eq('trip_id', tripId);
            
            const isDuplicate = (place: { id?: string; name: string; lat: number; lng: number }) => {
              if (!existingPlaces?.length) return false;
              const placeName = place.name.toLowerCase().trim();
              return existingPlaces.some((existing) => {
                if (place.id && existing.place_id && place.id === existing.place_id) return true;
                const existingName = (existing.name || '').toLowerCase().trim();
                if (existingName === placeName) {
                  return Math.abs(existing.lat - place.lat) < 0.00001 && 
                         Math.abs(existing.lng - place.lng) < 0.00001;
                }
                return false;
              });
            };
            
            let addedCount = 0;
            for (const place of results) {
              if (addedCount >= requestedLimit) break;
              if (!place?.name || place.name === 'undefined' || (place.lat === 0 && place.lng === 0)) continue;
              if (isDuplicate({ id: place.id, name: place.name, lat: place.lat, lng: place.lng })) continue;
              
              try {
                const { error } = await createPlace({
                  trip_id: tripId,
                  name: place.name,
                  lat: place.lat,
                  lng: place.lng,
                  category: mapCategory(place.category),
                  place_id: place.id || null,
                  created_by: user?.id || null,
                });
                if (!error) addedCount++;
              } catch (error) {
                console.error('Error creating place:', error);
              }
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
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      
      if (profilesError) {
        console.error('Error loading profiles:', profilesError);
      }
      
      if (profilesData) {
        console.log('Loaded profiles:', profilesData.length, 'for user IDs:', userIds);
        profilesMap = new Map(profilesData.map((p: any) => [p.id, p]));
        // Log each profile for debugging
        profilesData.forEach((p: any) => {
          console.log(`Profile for ${p.id}:`, { full_name: p.full_name, email: p.email });
        });
      } else {
        console.warn('No profiles found for user IDs:', userIds);
      }
    }

    // Combine messages with profiles
    const messagesWithProfiles = messagesData.map((msg: any) => {
      const profile = msg.user_id ? profilesMap.get(msg.user_id) : undefined;
      if (msg.user_id && !profile) {
        console.warn('No profile found for user ID:', msg.user_id, 'in message:', msg.id);
      }
      return {
        ...msg,
        profiles: profile,
      };
    });

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
    <div className="fixed right-0 top-0 h-full w-96 z-50 flex flex-col" style={{ backgroundColor: 'var(--card)', boxShadow: 'var(--shadow-xl)' }}>
      {/* Header */}
      <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <h2 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>Trip Chat</h2>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Collaborate with your group</p>
        </div>
        <button
          onClick={onClose}
          style={{ color: 'var(--foreground)' }}
          className="hover:opacity-70 transition-opacity"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="text-center" style={{ color: 'var(--foreground)' }}>Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center" style={{ color: 'var(--foreground)' }}>
            <p className="mb-2">Start the conversation!</p>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Ask the AI assistant for place recommendations.</p>
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
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                style={{
                  backgroundColor: message.role === 'assistant' ? 'var(--primary)' : 'var(--secondary)',
                  color: message.role === 'assistant' ? 'var(--primary-foreground)' : 'var(--secondary-foreground)'
                }}
              >
                {getSenderInitials(message)}
              </div>

              {/* Message Content */}
              <div className={`flex-1 ${message.user_id === user?.id ? 'items-end' : ''}`}>
                <div className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>
                  {getSenderName(message)}
                </div>
                <div
                  className="rounded-lg p-3"
                  style={{
                    backgroundColor: message.role === 'assistant'
                      ? 'var(--muted)'
                      : message.user_id === user?.id
                      ? 'var(--primary)'
                      : 'var(--accent)',
                    border: message.role === 'assistant' ? '1px solid var(--border)' : 'none',
                    color: message.user_id === user?.id ? 'var(--primary-foreground)' : 'var(--foreground)'
                  }}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  {new Date(message.created_at).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
              AI
            </div>
            <div className="flex-1">
              <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--muted)', border: '1px solid var(--border)' }}>
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--primary)' }}></div>
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--primary)', animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--primary)', animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>
          Say <span className="font-semibold" style={{ color: 'var(--foreground)' }}>"Hey Trippee"</span> to ask the AI assistant
        </p>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="flex-1 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 transition-all"
            style={{
              border: '1px solid var(--input)',
              backgroundColor: 'var(--background)',
              color: 'var(--foreground)',
              '--tw-ring-color': 'var(--ring)'
            }}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 rounded-lg transition-all disabled:cursor-not-allowed"
            style={{
              backgroundColor: isLoading || !input.trim() ? 'var(--muted)' : 'var(--primary)',
              color: isLoading || !input.trim() ? 'var(--muted-foreground)' : 'var(--primary-foreground)'
            }}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}