import { listEmployees } from './src/repos/employees.js';

async function main() {
  try {
    const result = await listEmployees({
      page: 1,
      perPage: 3,
      sortBy: 'fullName',
      sortDir: 'asc',
      displayCurrency: 'USD',
    });
    console.log('items:', result.items.length, 'total:', result.total);
    if (result.items[0]) {
      const item = result.items[0];
      console.log(JSON.stringify(item, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
    }
  } catch (err) {
    console.error('ERR:', err);
  }
  process.exit(0);
}

main();
