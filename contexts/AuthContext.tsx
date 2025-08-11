"use client";

import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';

// Types pour le nouveau système d'authentification
export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  role: string;
  partenaire_id: string;
  active: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
  require_password_change: boolean;
}

export interface Partner {
  id: string;
  company_name: string;
  legal_status: string;
  rccm: string;
  nif: string;
  activity_domain: string;
  headquarters_address: string;
  phone: string;
  email: string;
  employees_count: number;
  payroll: string;
  cdi_count: number;
  cdd_count: number;
  payment_date: string;
  rep_full_name: string;
  rep_position: string;
  rep_email: string;
  rep_phone: string;
  hr_full_name: string;
  hr_email: string;
  hr_phone: string;
  agreement: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'in_review';
  motivation_letter_url?: string;
  motivation_letter_text?: string;
  payment_day?: number;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthSession {
  user: User;           // Utilisateur Supabase auth.users
  admin: AdminUser;     // Profil admin_users
  partner: Partner;     // Données du partenaire
}

interface AuthContextType {
  session: AuthSession | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ error: any; session?: AuthSession | null }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearCache: () => void;
  forceRefresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { session, loading, error, signIn, signOut, refreshSession, clearCache, forceRefresh } = useSession();

  // Log des erreurs pour le debugging
  useEffect(() => {
    if (error) {
      console.error('Erreur d\'authentification:', error);
    }
  }, [error]);

  const value = {
    session,
    loading,
    error,
    signIn,
    signOut,
    refreshSession,
    clearCache,
    forceRefresh
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
