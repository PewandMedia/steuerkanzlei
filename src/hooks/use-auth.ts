import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type BenutzerRolle = Database["public"]["Enums"]["benutzer_rolle"];

interface AuthState {
  user: User | null;
  rolle: BenutzerRolle | null;
  benutzerId: string | null;
  benutzerName: string | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    rolle: null,
    benutzerId: null,
    benutzerName: null,
    loading: true,
  });

  const fetchProfile = async (user: User) => {
    const [roleRes, profileRes] = await Promise.all([
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("benutzer")
        .select("id, name")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    setState({
      user,
      rolle: roleRes.data?.role ?? null,
      benutzerId: profileRes.data?.id ?? null,
      benutzerName: profileRes.data?.name ?? null,
      loading: false,
    });
  };

  useEffect(() => {
    // 1. Restore session from storage first
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user);
      } else {
        setState({ user: null, rolle: null, benutzerId: null, benutzerName: null, loading: false });
      }
    });

    // 2. Listen for subsequent changes (no await in callback!)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          fetchProfile(session.user);
        } else {
          setState({ user: null, rolle: null, benutzerId: null, benutzerName: null, loading: false });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { ...state, signOut };
}
