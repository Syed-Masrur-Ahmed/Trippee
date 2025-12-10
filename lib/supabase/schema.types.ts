export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      trips: {
        Row: {
          id: string
          name: string
          created_at: string
          created_by: string
          original_created_by: string | null
          trip_days: number
          start_date: string | null
          end_date: string | null
          metadata: Json
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          created_by?: string
          original_created_by?: string | null
          trip_days?: number
          start_date?: string | null
          end_date?: string | null
          metadata?: Json
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          created_by?: string
          original_created_by?: string | null
          trip_days?: number
          start_date?: string | null
          end_date?: string | null
          metadata?: Json
        }
      }
      places: {
        Row: {
          id: string
          trip_id: string
          name: string
          lat: number
          lng: number
          category: string | null
          day_assigned: number | null
          order_index: number | null
          notes: string | null
          address: string | null
          place_id: string | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          trip_id: string
          name: string
          lat: number
          lng: number
          category?: string | null
          day_assigned?: number | null
          order_index?: number | null
          notes?: string | null
          address?: string | null
          place_id?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          trip_id?: string
          name?: string
          lat?: number
          lng?: number
          category?: string | null
          day_assigned?: number | null
          order_index?: number | null
          notes?: string | null
          address?: string | null
          place_id?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          email: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          email?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          email?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      trip_members: {
        Row: {
          id: string
          trip_id: string
          user_id: string
          role: string
          joined_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          user_id: string
          role?: string
          joined_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          user_id?: string
          role?: string
          joined_at?: string
        }
      }
      trip_messages: {
        Row: {
          id: string
          trip_id: string
          user_id: string
          content: string
          is_ai: boolean
          created_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          user_id: string
          content: string
          is_ai?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          user_id?: string
          content?: string
          is_ai?: boolean
          created_at?: string
        }
      }
      notes: {
        Row: {
          id: string
          trip_id: string
          place_id: string | null
          content: Json
          last_edited_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          place_id?: string | null
          content?: Json
          last_edited_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          place_id?: string | null
          content?: Json
          last_edited_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      trip_invitations: {
        Row: {
          id: string
          trip_id: string
          email: string
          token: string
          invited_by: string
          status: string
          created_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          email: string
          token?: string
          invited_by: string
          status?: string
          created_at?: string
          expires_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          email?: string
          token?: string
          invited_by?: string
          status?: string
          created_at?: string
          expires_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types for common use cases
export type Trip = Database['public']['Tables']['trips']['Row']
export type Place = Database['public']['Tables']['places']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type TripMember = Database['public']['Tables']['trip_members']['Row']
export type TripMessage = Database['public']['Tables']['trip_messages']['Row']
export type Note = Database['public']['Tables']['notes']['Row']
export type TripInvitation = Database['public']['Tables']['trip_invitations']['Row']

// Google Places API types
export interface GooglePlacePhoto {
  name: string
  widthPx?: number
  heightPx?: number
}

export interface GooglePlaceReview {
  authorName?: string
  rating?: number
  text?: { text: string }
  relativePublishTimeDescription?: string
}

export interface GooglePlaceResult {
  id: string
  displayName?: { text: string }
  formattedAddress?: string
  location?: { latitude: number; longitude: number }
  rating?: number
  userRatingCount?: number
  priceLevel?: string
  regularOpeningHours?: { weekdayDescriptions?: string[] }
  photos?: GooglePlacePhoto[]
  reviews?: GooglePlaceReview[]
  types?: string[]
  websiteUri?: string
  nationalPhoneNumber?: string
}

// Tiptap content types
export interface TiptapNode {
  type: string
  content?: TiptapNode[]
  text?: string
  marks?: Array<{ type: string }>
}

export interface TiptapContent {
  type: 'doc'
  content?: TiptapNode[]
}

