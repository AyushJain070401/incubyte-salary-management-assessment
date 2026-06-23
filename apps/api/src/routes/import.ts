import { Router } from 'express';
import express from 'express';
import { postEmployeeImport } from '../controllers/import.js';

export const importRouter: Router = Router();

// Body parser scoped to this router: accept text/csv up to 10MB.
// Default express.json() in app.ts doesn't parse text/csv, so we add
// a tighter, route-specific parser here.
importRouter.use(express.text({ type: 'text/csv', limit: '10mb' }));

importRouter.post('/employees', postEmployeeImport);
