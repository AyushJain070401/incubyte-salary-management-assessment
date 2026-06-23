import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

// All routes mounted under /api are gated by requireAuth.
// Individual resource routers (employees, analytics, import) attach to
// this router as features land.
export const apiRouter: Router = Router();

apiRouter.use(requireAuth);

// Placeholder so the auth middleware has something to protect today.
// Removed once the employees router is wired in commit 9.
apiRouter.get('/me', (req, res) => {
  res.json({ user: req.user });
});
