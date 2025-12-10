'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { TiptapContent } from '@/lib/supabase/schema.types';

interface NotesEditorProps {
  tripId: string;
  placeId: string | null;
}

export default function NotesEditor({ tripId, placeId }: NotesEditorProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState(false);
  const [otherUsers, setOtherUsers] = useState<string[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRemoteUpdateRef = useRef(false);

  const noteIdRef = useRef<string | null>(null);

  // Debounced save function
  const saveContent = useCallback(async (content: Record<string, unknown>) => {
    if (!user || !tripId) return;

    setSaving(true);
    try {
      if (noteIdRef.current) {
        // Update existing note
        const { error } = await (supabase
          .from('notes') as any)
          .update({ content })
          .eq('id', noteIdRef.current);

      } else {
        // Create new note
        const { data, error } = await (supabase
          .from('notes') as any)
          .insert({
            trip_id: tripId,
            place_id: placeId,
            content: content,
          })
          .select('id')
          .single();

        if (!error && data) {
          noteIdRef.current = data.id;
        }
      }
    } catch {
      // Silent fail for note saving
    } finally {
      setSaving(false);
    }
  }, [user, tripId, placeId]);

  // Editor setup
  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      // Skip if this is a remote update
      if (isRemoteUpdateRef.current) return;

      const content = editor.getJSON();

      // Broadcast to other users
      if (channelRef.current && connected) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'content-update',
          payload: { content, userId: user?.id },
        });
      }

      // Debounced save to database
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveContent(content);
      }, 1000);
    },
  });

  // Load content and set up realtime
  useEffect(() => {
    if (!user || !tripId || !editor) return;

    let isMounted = true;

    async function loadContent() {
      try {
        let query = supabase
          .from('notes')
          .select('id, content, updated_at')
          .eq('trip_id', tripId)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (placeId === null) {
          query = query.is('place_id', null);
        } else {
          query = query.eq('place_id', placeId);
        }

        const { data, error } = await query;
        const noteData = data?.[0] as { id: string; content: TiptapContent | null } | undefined;

        if (!error && noteData && isMounted && editor) {
          noteIdRef.current = noteData.id;
          if (noteData.content) {
            isRemoteUpdateRef.current = true;
            editor.commands.setContent(noteData.content);
            isRemoteUpdateRef.current = false;
          }
        }
      } catch {
        // Note not found, start with empty editor
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    // Set up realtime channel
    const channelName = `notes:${tripId}:${placeId || 'general'}`;
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
        presence: { key: user.id },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: string[] = [];
        interface PresencePayload {
          user?: { id: string; name?: string };
        }
        Object.values(state).forEach((presences) => {
          (presences as PresencePayload[]).forEach((p) => {
            if (p.user?.name && p.user?.id !== user.id) {
              users.push(p.user.name);
            }
          });
        });
        setOtherUsers(users);
      })
      .on('broadcast', { event: 'content-update' }, ({ payload }) => {
        if (payload.userId !== user.id && payload.content) {
          isRemoteUpdateRef.current = true;
          editor.commands.setContent(payload.content);
          isRemoteUpdateRef.current = false;
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          await channel.track({
            user: {
              id: user.id,
              name: user.user_metadata?.full_name || user.email || 'User',
            },
          });
        }
      });

    channelRef.current = channel;
    loadContent();

    return () => {
      isMounted = false;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        // Save immediately on unmount
        if (editor && !editor.isDestroyed) {
          saveContent(editor.getJSON());
        }
      }
      channel.unsubscribe();
    };
  }, [user, tripId, placeId, editor, saveContent]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ backgroundColor: 'var(--background)' }}>
        <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '2px solid var(--border)', borderTopColor: 'var(--primary)' }} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
      {/* Header */}
      <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--card)' }}>
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            {placeId ? 'Place Notes' : 'General Trip Notes'}
          </h2>
          <div className="flex items-center gap-2 text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: connected ? '#22c55e' : '#ef4444' }} />
              {connected ? 'Connected' : 'Disconnected'}
            </span>
            {saving && <span>• Saving...</span>}
          </div>
        </div>
        {otherUsers.length > 0 && (
          <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Also here: {otherUsers.join(', ')}
          </div>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto p-6">
        <EditorContent 
          editor={editor} 
          className="tiptap-editor min-h-full"
          style={{ color: 'var(--foreground)' }}
        />
      </div>
    </div>
  );
}
