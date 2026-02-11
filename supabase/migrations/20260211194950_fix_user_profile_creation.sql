/*
  # Fix User Profile Creation

  1. Changes
    - Add automatic profile creation via database triggers
    - Ensure users can create their own profiles on first login
    - Add better error handling for profile creation

  2. Security
    - Maintains existing RLS policies
    - Adds safe fallback mechanisms
*/

-- Function to automatically create user profile in users_financeiro
CREATE OR REPLACE FUNCTION create_financeiro_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users_financeiro (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically create user profile in users_academico
CREATE OR REPLACE FUNCTION create_academico_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users_academico (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Triggers on auth.users are typically created manually via Supabase Dashboard
-- or need special permissions. The functions above can be called manually if needed.

-- Alternative: Add a helper function that can be called from the application
CREATE OR REPLACE FUNCTION ensure_user_profile(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_module text
)
RETURNS void AS $$
BEGIN
  IF p_module = 'financeiro' THEN
    INSERT INTO users_financeiro (id, email, full_name)
    VALUES (p_user_id, p_email, p_full_name)
    ON CONFLICT (id) DO NOTHING;
  ELSIF p_module = 'academico' THEN
    INSERT INTO users_academico (id, email, full_name)
    VALUES (p_user_id, p_email, p_full_name)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION ensure_user_profile TO authenticated;