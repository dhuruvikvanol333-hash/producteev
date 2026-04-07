import { createApp } from './app';
import { config } from './config';
import { createServer } from 'http';
import { initializeSocket } from './socket';
import { prisma } from './config/database';
import { redis } from './config/redis';

async function startServer(port: number): Promise<void> {
  const app = createApp();
  const httpServer = createServer(app);

  initializeSocket(httpServer);

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      console.warn(`Port ${port} is already in use, trying port ${nextPort}...`);
      httpServer.close();
      startServer(nextPort);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });

  httpServer.listen(port, () => {
    console.log(`Server running on port ${port} in ${config.NODE_ENV} mode`);
  });

  const shutdown = async () => {
    console.log('Shutting down gracefully...');
    httpServer.close();
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

async function main() {
  await startServer(config.PORT);
}

main().catch(console.error);
