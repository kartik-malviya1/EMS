import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/user.model.js';
import { ROLES } from '../config/constants.js';
import { logger } from '../utils/logger.js';

let io = null;

export const initSocketServer = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_ORIGIN || 'http://localhost:5173',
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
        socket.handshake.headers?.token;

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      let payload;
      try {
        payload = jwt.verify(token, env.JWT_SECRET);
      } catch (err) {
        return next(new Error(`Invalid token: ${err.message}`));
      }

      if (payload.purpose !== 'socket') {
        return next(
          new Error('Invalid token purpose: socket connection requires purpose="socket"')
        );
      }

      const user = await User.findById(payload.sub);
      if (!user) {
        return next(new Error('User not found'));
      }

      if (!user.isActive) {
        return next(new Error('Account is inactive'));
      }

      socket.user = user;
      next();
    } catch (err) {
      next(err);
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    socket.join(`user:${userId}`);

    if (socket.user.role === ROLES.ADMIN) {
      socket.join('role:admin');
    } else if (socket.user.role === ROLES.MANAGER) {
      socket.join(`team:${userId}`);
      socket.join(`role:manager:${userId}`);
    }

    logger.info(`Socket connected: ${userId} (${socket.user.role}), socketId: ${socket.id}`);

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${userId}`);
    });
  });

  return io;
};

export const getIO = () => io;

export const setIO = (instance) => {
  io = instance;
};

export const emitToUser = (userId, event, payload) => {
  if (!io || !userId) return;
  io.to(`user:${userId.toString()}`).emit(event, payload);
};

export const emitToAdmin = (event, payload) => {
  if (!io) return;
  io.to('role:admin').emit(event, payload);
};

export const emitToManager = (managerId, event, payload) => {
  if (!io || !managerId) return;
  io.to(`team:${managerId.toString()}`).emit(event, payload);
  io.to(`user:${managerId.toString()}`).emit(event, payload);
};

export const emitNotification = (userId, notification) => {
  if (!io || !userId) return;
  io.to(`user:${userId.toString()}`).emit('notification:new', { notification });
};

export const emitAttendanceUpdated = (attendanceId, employeeId, managerId = null) => {
  if (!io) return;
  const payload = { attendanceId: attendanceId.toString() };
  if (employeeId) {
    io.to(`user:${employeeId.toString()}`).emit('attendance:updated', payload);
  }
  if (managerId) {
    io.to(`team:${managerId.toString()}`).emit('attendance:updated', payload);
    io.to(`user:${managerId.toString()}`).emit('attendance:updated', payload);
  }
  io.to('role:admin').emit('attendance:updated', payload);
};

export default {
  initSocketServer,
  getIO,
  setIO,
  emitToUser,
  emitToAdmin,
  emitToManager,
  emitNotification,
  emitAttendanceUpdated,
};
