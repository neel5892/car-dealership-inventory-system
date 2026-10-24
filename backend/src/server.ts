
import 'dotenv/config';
import app from './app';

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`Car Dealership API running at http://localhost:${PORT}`);
});
