import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, UserModule } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  module: UserModule | null;
  loading: boolean;
  signIn: (
    email: string,
    password: string,
    module: UserModule
  ) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    module: UserModule
  ) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [module, setModule] = useState<UserModule | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      const storedModule = localStorage.getItem(
        'userModule'
      ) as UserModule | null;
      setModule(storedModule);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      if (!session) {
        setModule(null);
        localStorage.removeItem('userModule');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // =========================
  // SIGN IN (login correto)
  // =========================
  const signIn = async (
    email: string,
    password: string,
    selectedModule: UserModule
  ) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Email ou senha incorretos');
        }
        if (error.message.includes('Email not confirmed')) {
          throw new Error('Por favor, confirme seu email antes de fazer login');
        }
        throw new Error('Erro ao fazer login. Tente novamente.');
      }

      if (!data.user) {
        throw new Error('Usuário não autenticado');
      }

      const tableName =
        selectedModule === 'financeiro'
          ? 'users_financeiro'
          : 'users_academico';

      const { data: profile, error: selectError } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (selectError) {
        console.error('Erro ao buscar perfil:', selectError);
        throw new Error('Erro ao carregar perfil do usuário');
      }

      if (!profile) {
        const fullName = data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'Usuário';

        const { error: insertError } = await supabase.from(tableName).insert({
          id: data.user.id,
          email: data.user.email,
          full_name: fullName,
        });

        if (insertError) {
          console.error('Erro ao criar perfil:', insertError);

          if (insertError.message.includes('duplicate key')) {
            throw new Error('Este usuário já possui um perfil neste módulo');
          }

          throw new Error('Erro ao criar perfil do usuário. Entre em contato com o suporte.');
        }
      }

      setModule(selectedModule);
      localStorage.setItem('userModule', selectedModule);
    } catch (error: any) {
      console.error('Erro no signIn:', error);
      throw error;
    }
  };

  // =========================
  // SIGN UP
  // =========================
  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    selectedModule: UserModule
  ) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        if (error.message.includes('User already registered')) {
          throw new Error('Este email já está cadastrado');
        }
        if (error.message.includes('Password should be at least')) {
          throw new Error('A senha deve ter pelo menos 6 caracteres');
        }
        throw new Error('Erro ao criar conta. Tente novamente.');
      }

      if (!data.user) {
        throw new Error('Falha ao criar usuário');
      }

      if (data.session) {
        const tableName =
          selectedModule === 'financeiro'
            ? 'users_financeiro'
            : 'users_academico';

        const { error: insertError } = await supabase.from(tableName).insert({
          id: data.user.id,
          email: data.user.email,
          full_name: fullName,
        });

        if (insertError) {
          console.error('Erro ao criar perfil:', insertError);

          if (insertError.message.includes('duplicate key')) {
            throw new Error('Já existe um perfil para este usuário');
          }

          throw new Error('Erro ao criar perfil. Entre em contato com o suporte.');
        }

        setModule(selectedModule);
        localStorage.setItem('userModule', selectedModule);
      } else {
        throw new Error('Conta criada! Por favor, confirme seu email antes de fazer login.');
      }
    } catch (error: any) {
      console.error('Erro no signUp:', error);
      throw error;
    }
  };

  // =========================
  // SIGN OUT
  // =========================
  const signOut = async () => {
    await supabase.auth.signOut();
    setModule(null);
    localStorage.removeItem('userModule');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        module,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

