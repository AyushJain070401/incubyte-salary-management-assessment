import { Router } from 'express';
import {
  listEmployees,
  getEmployee,
  listSalaries,
  postRaise,
  patchEmployee,
  listChanges,
} from '../controllers/employees.js';

export const employeesRouter: Router = Router();

employeesRouter.get('/', listEmployees);
employeesRouter.get('/:id', getEmployee);
employeesRouter.patch('/:id', patchEmployee);
employeesRouter.get('/:id/salaries', listSalaries);
employeesRouter.get('/:id/changes', listChanges);
employeesRouter.post('/:id/raise', postRaise);
