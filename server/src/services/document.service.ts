/**
 * Document Service - Handles file storage via Cloudinary
 * @module services/document.service
 */

import { v2 as cloudinary } from 'cloudinary';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { PRODUCT_STORAGE_PREFIX } from '../config/productIdentity';

// Cloudinary is configured via CLOUDINARY_URL in .env
// No explicit config() call needed if CLOUDINARY_URL is present

export interface UploadResult {
    url: string;
    publicId: string;
    format: string;
    size: number;
    resourceType: string;
}

export interface UploadOptions {
    folder?: string;
    resourceType?: 'image' | 'video' | 'raw' | 'auto';
    allowedFormats?: string[];
    maxSize?: number; // in bytes
}

class DocumentService {
    /**
     * Upload a file to Cloudinary
     */
    async uploadFile(
        file: Express.Multer.File,
        options: UploadOptions = {}
    ): Promise<UploadResult> {
        const { folder = `${PRODUCT_STORAGE_PREFIX}/documents`, maxSize, allowedFormats, resourceType = 'auto' } = options;

        if (maxSize && file.size > maxSize) {
            throw new Error(`File size exceeds maximum allowed size of ${maxSize} bytes`);
        }

        if (allowedFormats && allowedFormats.length > 0) {
            const fileExt = file.originalname.split('.').pop()?.toLowerCase();
            if (!fileExt || !allowedFormats.includes(fileExt)) {
                throw new Error(`File format not allowed. Allowed: ${allowedFormats.join(', ')}`);
            }
        }

        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder,
                    resource_type: resourceType,
                    // Ensure unique public_id to avoid accidental overwrites
                    public_id: `${path.parse(file.originalname).name.replace(/[^a-zA-Z0-9]/g, '_')}_${uuidv4().substring(0, 8)}`,
                },
                (error, result) => {
                    if (error) {
                        console.error('[Document Service] Cloudinary upload error:', error);
                        return reject(new Error(`Failed to upload file: ${error.message}`));
                    }
                    if (!result) {
                        return reject(new Error('Upload failed: No result from Cloudinary'));
                    }
                    
                    resolve({
                        url: result.secure_url,
                        publicId: result.public_id,
                        format: result.format || file.originalname.split('.').pop() || 'raw',
                        size: result.bytes,
                        resourceType: result.resource_type
                    });
                }
            );

            uploadStream.end(file.buffer);
        });
    }

    /**
     * Upload multiple files
     */
    async uploadMultipleFiles(
        files: Express.Multer.File[],
        options: UploadOptions = {}
    ): Promise<UploadResult[]> {
        return Promise.all(files.map(file => this.uploadFile(file, options)));
    }

    /**
     * Delete a file from Cloudinary
     */
    async deleteFile(publicId: string, resourceType: string = 'auto'): Promise<void> {
        return new Promise((resolve, reject) => {
            cloudinary.uploader.destroy(publicId, { resource_type: resourceType as any }, (error, result) => {
                if (error) {
                    console.error('[Document Service] Cloudinary delete error:', error);
                    return reject(new Error(`Failed to delete file: ${error.message}`));
                }
                if (result.row === 'not found') {
                    console.warn(`[Document Service] File ${publicId} not found in Cloudinary`);
                }
                resolve();
            });
        });
    }

    /**
     * Delete multiple files
     */
    async deleteMultipleFiles(publicIds: string[], resourceType: string = 'auto'): Promise<void> {
        // Cloudinary bulk delete is usually via API, but here we can just loop or use resources API if enabled
        // For simplicity and consistency with existing interface, we use Promise.all
        await Promise.all(publicIds.map(id => this.deleteFile(id, resourceType)));
    }

    /**
     * Get a signed URL for temporary private access
     * Note: For Cloudinary, we typically use the secure_url unless the asset is upload_type 'private' or 'authenticated'
     */
    async generateSignedUrl(publicId: string, _expiresIn: number = 3600): Promise<string> {
        // By default, we return the secure URL. 
        // If true private delivery is needed, this would require cloudinary.utils.private_download_url
        return cloudinary.url(publicId, { secure: true });
    }
}

export const documentService = new DocumentService();
