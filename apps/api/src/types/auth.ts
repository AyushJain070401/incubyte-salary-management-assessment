// Augments Express's Request with a typed `user` field, populated by the
// auth middleware once a request has been authenticated.

export type AuthenticatedUser = {
  // Supabase user id (uuid). Stored on salary audit rows as `changed_by`.
  id: string;
  email: string | null;
  // Supabase token roles: 'authenticated' for logged-in users; 'anon' for
  // public requests (we reject those). Keep typed in case we need to
  // discriminate later.
  role: 'authenticated' | 'anon' | string;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
