"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signInWithCustomToken, signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/shared/api/firebase";
import type { UserRole } from "@/shared/types";

interface AuthUser {
  uid: string;
  uniqueCode: string;
  name: string;
  role: UserRole;
  teamId: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (code: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (firebaseUser) => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdTokenResult();
        setUser({
          uid: firebaseUser.uid,
          uniqueCode: (token.claims.uniqueCode as string) || "",
          name: (token.claims.name as string) || "",
          role: (token.claims.role as UserRole) || "participant",
          teamId: (token.claims.teamId as string) || null,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (code: string) => {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "인증에 실패했습니다");
    }

    const { token } = await res.json();
    await signInWithCustomToken(getFirebaseAuth(), token);
  };

  const logout = async () => {
    await signOut(getFirebaseAuth());
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
