import { Router } from 'express';
import { listEmployees } from '../controllers/employees.js';

export const employeesRouter: Router = Router();

employeesRouter.get('/', listEmployees);
