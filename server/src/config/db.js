import mongoose from 'mongoose';
import dns from 'dns';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export const connectDB = async (uri = env.MONGODB_URI) => {
  try {
    // If connecting to mongodb+srv on Windows where router DNS may fail SRV lookups, set public DNS
    if (uri && uri.startsWith('mongodb+srv://')) {
      try {
        dns.setServers(['8.8.8.8', '1.1.1.1']);
      } catch (dnsErr) {
        logger.warn('Could not set custom DNS servers:', dnsErr.message);
      }
    }

    const conn = await mongoose.connect(uri);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error('MongoDB Connection Error:', error.message);
    throw error;
  }
};

export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB Disconnected');
  } catch (error) {
    logger.error('Error disconnecting MongoDB:', error.message);
  }
};

export default connectDB;
