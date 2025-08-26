import dotenv from 'dotenv';
import { TraceService } from './TraceService';

// Load environment variables
dotenv.config();

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the service
async function start() {
  try {
    const traceService = new TraceService();
    await traceService.start();
    
    console.log('🚀 Trace Service started successfully');
    console.log(`📊 Service: ${process.env.npm_package_name || 'trace-service'}`);
    console.log(`🔌 Port: ${process.env.PORT || 8003}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  } catch (error) {
    console.error('❌ Failed to start Trace Service:', error);
    process.exit(1);
  }
}

start();