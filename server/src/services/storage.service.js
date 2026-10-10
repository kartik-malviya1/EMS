import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Configure Cloudinary from env
if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * In-memory fake storage adapter for testing
 */
export class InMemoryStorageAdapter {
  constructor() {
    this.storage = new Map();
  }

  async upload({ buffer, mimeType, publicId }) {
    this.storage.set(publicId, { buffer, mimeType });
    return {
      publicId,
      bytes: buffer.length,
      mimeType,
    };
  }

  async get(publicId) {
    const item = this.storage.get(publicId);
    if (!item) {
      throw new Error(`File with publicId ${publicId} not found in fake storage`);
    }
    return item;
  }

  async delete(publicId) {
    this.storage.delete(publicId);
  }

  clear() {
    this.storage.clear();
  }
}

/**
 * Real Cloudinary storage adapter
 */
export class CloudinaryStorageAdapter {
  async upload({ buffer, mimeType, publicId }) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          type: 'authenticated', // private authenticated access
          resource_type: 'image',
          overwrite: true,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve({
            publicId: result.public_id,
            bytes: result.bytes,
            mimeType,
          });
        }
      );
      uploadStream.end(buffer);
    });
  }

  async get(publicId) {
    // Generate signed URL with 5-minute expiry
    const expiresAt = Math.floor(Date.now() / 1000) + 300;
    const signedUrl = cloudinary.utils.private_download_url(publicId, 'jpg', {
      type: 'authenticated',
      expires_at: expiresAt,
    });

    const response = await fetch(signedUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch selfie from Cloudinary: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = response.headers.get('content-type') || 'image/jpeg';

    return { buffer, mimeType };
  }

  async delete(publicId) {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(
        publicId,
        { type: 'authenticated', resource_type: 'image' },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
    });
  }
}

// Default adapter selection
let currentAdapter =
  env.NODE_ENV === 'test'
    ? new InMemoryStorageAdapter()
    : new CloudinaryStorageAdapter();

export const setStorageAdapter = (adapter) => {
  currentAdapter = adapter;
};

export const getStorageAdapter = () => currentAdapter;

/**
 * Uploads a punch selfie
 */
export const uploadSelfie = async ({ buffer, mimeType, employeeId, workDate, kind }) => {
  const folder = `${env.CLOUDINARY_FOLDER || 'attendance'}/${employeeId}/${workDate}`;
  const publicId = `${folder}/${kind}`;

  return currentAdapter.upload({ buffer, mimeType, publicId });
};

/**
 * Retrieves selfie bytes and mimeType for streaming
 */
export const getSelfie = async (publicId) => {
  return currentAdapter.get(publicId);
};

/**
 * Deletes selfie on failure
 */
export const deleteSelfie = async (publicId) => {
  try {
    await currentAdapter.delete(publicId);
  } catch (error) {
    logger.error(`Best-effort deleteSelfie failed for ${publicId}:`, error.message);
  }
};

export default {
  uploadSelfie,
  getSelfie,
  deleteSelfie,
  setStorageAdapter,
  getStorageAdapter,
};
