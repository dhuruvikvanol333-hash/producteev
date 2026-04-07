import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { OrgRole } from '@prisma/client';
import { NotificationService } from './notification.service';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const THUMB_DIR = path.join(UPLOAD_DIR, 'thumbnails');

// Ensure directories exist
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(THUMB_DIR)) {
  fs.mkdirSync(THUMB_DIR, { recursive: true });
}

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
]);

// Dangerous file signatures (basic safety check)
const DANGEROUS_SIGNATURES: Buffer[] = [
  Buffer.from('4D5A', 'hex'),         // EXE/DLL (MZ header)
  Buffer.from('7F454C46', 'hex'),     // ELF binary
];

export class AttachmentService {
  /** Validate file type is allowed */
  static validateFileType(_mimeType: string, originalName: string): void {
    // Block dangerous extensions like file.pdf.exe
    const ext = path.extname(originalName).toLowerCase();
    const dangerousExts = ['.exe', '.bat', '.cmd', '.sh', '.msi', '.dll', '.com', '.scr', '.ps1', '.vbs', '.js', '.jar'];
    if (dangerousExts.includes(ext)) {
      throw ApiError.badRequest('This file type is not allowed for security reasons.');
    }
  }

  /** Basic file safety check - scan first bytes for dangerous signatures */
  static async scanFile(filePath: string): Promise<void> {
    const fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(8);
    fs.readSync(fd, header, 0, 8, 0);
    fs.closeSync(fd);

    for (const sig of DANGEROUS_SIGNATURES) {
      if (header.subarray(0, sig.length).equals(sig)) {
        // Delete the file immediately
        fs.unlinkSync(filePath);
        throw ApiError.badRequest('File failed security check. Upload rejected.');
      }
    }
  }

  /** Generate thumbnail for image files */
  static async generateThumbnail(filename: string, mimeType: string): Promise<string | null> {
    if (!IMAGE_MIME_TYPES.has(mimeType)) return null;

    const sourcePath = path.join(UPLOAD_DIR, filename);
    const thumbFilename = `thumb_${filename}`;
    const thumbPath = path.join(THUMB_DIR, thumbFilename);

    try {
      await sharp(sourcePath)
        .resize(200, 200, { fit: 'cover', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(thumbPath);

      return thumbFilename;
    } catch {
      console.error(`Failed to generate thumbnail for ${filename}`);
      return null;
    }
  }

  static isImage(mimeType: string): boolean {
    return IMAGE_MIME_TYPES.has(mimeType);
  }

  static async create(input: {
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    taskId: string;
    uploadedById: string;
  }, role: OrgRole) {
    // Verify task exists
    const task = await prisma.task.findUnique({ where: { id: input.taskId } });
    if (!task) throw ApiError.notFound('Task not found');

    // Validate file type
    AttachmentService.validateFileType(input.mimeType, input.originalName);

    // Basic file safety scan
    const filePath = path.join(UPLOAD_DIR, input.filename);
    await AttachmentService.scanFile(filePath);

    // Generate thumbnail for images
    const thumbnail = await AttachmentService.generateThumbnail(input.filename, input.mimeType);

    const attachment = await prisma.attachment.create({
      data: input,
      include: {
        uploadedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    // Notify activity
    await NotificationService.notifyTaskActivity(
      input.taskId,
      input.uploadedById,
      role,
      task.title,
      `${attachment.uploadedBy.firstName} added an attachment: ${input.originalName}`
    );

    return {
      ...attachment,
      thumbnailUrl: thumbnail ? `/uploads/thumbnails/${thumbnail}` : null,
      isImage: AttachmentService.isImage(input.mimeType),
    };
  }

  static async getByTask(taskId: string) {
    const attachments = await prisma.attachment.findMany({
      where: { taskId },
      include: {
        uploadedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return attachments.map((att) => {
      const isImage = AttachmentService.isImage(att.mimeType);
      const thumbFilename = `thumb_${att.filename}`;

      return {
        ...att,
        isImage,
        thumbnailUrl: isImage ? `/uploads/thumbnails/${thumbFilename}` : null,
      };
    });
  }

  static async getById(id: string) {
    const attachment = await prisma.attachment.findUnique({
      where: { id },
      include: {
        uploadedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
    if (!attachment) throw ApiError.notFound('Attachment not found');
    return attachment;
  }

  static async delete(id: string, _userId: string) {
    const attachment = await prisma.attachment.findUnique({ where: { id } });
    if (!attachment) throw ApiError.notFound('Attachment not found');

    // Delete file from disk
    const filePath = path.join(UPLOAD_DIR, attachment.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete thumbnail if exists
    const thumbPath = path.join(THUMB_DIR, `thumb_${attachment.filename}`);
    if (fs.existsSync(thumbPath)) {
      fs.unlinkSync(thumbPath);
    }

    await prisma.attachment.delete({ where: { id } });
  }

  static getUploadDir() {
    return UPLOAD_DIR;
  }

  static getFilePath(filename: string) {
    return path.join(UPLOAD_DIR, filename);
  }
}
