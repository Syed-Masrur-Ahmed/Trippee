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
          trip_days: number
          start_date: string | null
          metadata: Json
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          trip_days?: number
          start_date?: string | null
          metadata?: Json
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          trip_days?: number
          start_date?: string | null
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
    }
  }
}

