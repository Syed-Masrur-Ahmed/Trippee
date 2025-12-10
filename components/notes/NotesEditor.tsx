'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { TiptapContent } from '@/lib/supabase/schema.types';
import type { NoteSelection } from './NotesSidebar';

interface NotesEditorProps {
  tripId: string;
  noteSelection: NoteSelection;
}

// Parse the note selection to determine if it's a place, day, or general note
function parseNoteSelection(selection: NoteSelection): { placeId: string | null; dayNumber: number | null } {
  if (selection === null) {
    return { placeId: null, dayNumber: null }; // General trip note
  }
  if (selection.startsWith('day-')) {
    const dayNumber = parseInt(selection.replace('day-', ''), 10);
    return { placeId: null, dayNumber }; // Day note
  }
  return { placeId: selection, dayNumber: null }; // Place note
}

export default function NotesEditor({ tripId, noteSelection }: NotesEditorProps) {
  const { placeId, dayNumber } = parseNoteSelection(noteSelection);
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
        await (supabase
          .from('notes') as any)
          .update({ content })
          .eq('id', noteIdRef.current);

      } else {
        // Try to find existing note first (in case it was created in another session)
        let query = supabase
          .from('notes')
          .select('id')
          .eq('trip_id', tripId)
          .limit(1);

        if (dayNumber !== null) {
          query = query.eq('day_number', dayNumber).is('place_id', null);
        } else if (placeId !== null) {
          query = query.eq('place_id', placeId).is('day_number', null);
        } else {
          query = query.is('place_id', null).is('day_number', null);
        }

        const { data: existingNote } = await query;
        
        if (existingNote && existingNote[0]) {
          // Note exists, update it
          noteIdRef.current = existingNote[0].id;
          await (supabase
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
              day_number: dayNumber,
              content: content,
            })
            .select('id')
            .single();

          if (!error && data) {
            noteIdRef.current = data.id;
          }
        }
      }
    } catch {
      // Silent fail for note saving
    } finally {
      setSaving(false);
    }
  }, [user, tripId, placeId, dayNumber]);

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
    
    // Reset note ID when selection changes
    noteIdRef.current = null;
    // Reset editor content
    isRemoteUpdateRef.current = true;
    editor.commands.setContent('');
    isRemoteUpdateRef.current = false;
    setLoading(true);

    async function loadContent() {
      try {
        let query = supabase
          .from('notes')
          .select('id, content, updated_at')
          .eq('trip_id', tripId)
          .order('updated_at', { ascending: false })
          .limit(1);

        // Query based on note type
        if (dayNumber !== null) {
          // Day note
          query = query.eq('day_number', dayNumber).is('place_id', null);
        } else if (placeId !== null) {
          // Place note
          query = query.eq('place_id', placeId).is('day_number', null);
        } else {
          // General trip note
          query = query.is('place_id', null).is('day_number', null);
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
    const channelId = dayNumber !== null ? `day-${dayNumber}` : (placeId || 'general');
    const channelName = `notes:${tripId}:${channelId}`;
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
  }, [user, tripId, placeId, dayNumber, editor, saveContent]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ backgroundColor: 'var(--background)' }}>
        <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '2px solid var(--border)', borderTopColor: 'var(--primary)' }} />
      </div>
    );
  }

  // Determine the title based on note type
  const getTitle = () => {
    if (dayNumber !== null) return `Day ${dayNumber} Notes`;
    if (placeId !== null) return 'Place Notes';
    return 'General Trip Notes';
  };

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
      {/* Header */}
      <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--card)' }}>
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            {getTitle()}
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
