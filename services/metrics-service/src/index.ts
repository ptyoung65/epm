import { MetricsService } from './MetricsService';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create and start the service
const service = new MetricsService();

service.start().catch((error) => {
  console.error('Failed to start Metrics Service:', error);
  process.exit(1);
});