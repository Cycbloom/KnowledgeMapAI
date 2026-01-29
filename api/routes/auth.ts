import { Router, type Request, type Response } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();

/**
 * User Register
 * POST /api/auth/register
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, password, and name are required' });
      return;
    }

    // 1. Sign up with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      res.status(400).json({ error: authError.message });
      return;
    }

    if (!authData.user) {
      res.status(500).json({ error: 'Failed to create user' });
      return;
    }

    // 2. Create user record in public.users
    const { error: dbError } = await supabase
      .from('users')
      .insert([
        {
          id: authData.user.id,
          email: email,
          password_hash: 'MANAGED_BY_SUPABASE_AUTH', // We don't store actual hash here
          name: name,
        },
      ]);

    if (dbError) {
      // Cleanup auth user if db insert fails (optional but good practice)
      // await supabase.auth.admin.deleteUser(authData.user.id);
      res.status(500).json({ error: 'Failed to create user profile: ' + dbError.message });
      return;
    }

    res.status(201).json({ user: authData.user, session: authData.session });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

/**
 * User Login
 * POST /api/auth/login
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      res.status(401).json({ error: error.message });
      return;
    }

    res.json({ user: data.user, session: data.session });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

/**
 * User Logout
 * POST /api/auth/logout
 */
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ message: 'Logged out successfully' });
});

/**
 * Get Current User
 * GET /api/auth/user
 */
router.get('/user', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  // Fetch detailed profile from public.users
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', req.user.id)
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ user: { ...req.user, profile: data } });
});

export default router;
