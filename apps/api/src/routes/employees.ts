import { Router } from 'express';
import {
  listEmployees,
  getEmployee,
  listSalaries,
  postRaise,
} from '../controllers/employees.js';

export const employeesRouter: Router = Router();

employeesRouter.get('/', listEmployees);
employeesRouter.get('/:id', getEmployee);
employeesRouter.get('/:id/salaries', listSalaries);
employeesRouter.post('/:id/raise', postRaise);
