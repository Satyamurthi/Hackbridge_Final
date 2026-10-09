import fs from 'fs';
import path from 'path';

export interface StorageConstraint {
  maxSizeBytes: number;
  allowedMimes: string[];
}

export const STORAGE_CONSTRAINTS: Record<string, StorageConstraint> = {
  banners: {
    maxSizeBytes: 5 * 1024 * 1024,
    allowedMimes: ['image/png', 'image/jpeg', 'image/webp']
  },
  logos: {
    maxSizeBytes: 2 * 1024 * 1024,
    allowedMimes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
  },
  submissions: {
    maxSizeBytes: 25 * 1024 * 1024,
    allowedMimes: ['application/pdf', 'application/zip', 'image/png', 'image/jpeg']
  },
  resumes: {
    maxSizeBytes: 10 * 1024 * 1024,
    allowedMimes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  }
};

export class StorageService {
  private baseUploadDir: string;

  constructor(baseUploadDir?: string) {
    this.baseUploadDir = baseUploadDir || path.join(__dirname, '..', '..', 'uploads');
    if (!fs.existsSync(this.baseUploadDir)) {
      try {
        fs.mkdirSync(this.baseUploadDir, { recursive: true });
      } catch (err) {}
    }
  }

  validateFile(category: string, size: number, mimeType: string): { valid: boolean; error?: string } {
    const constraint = STORAGE_CONSTRAINTS[category];
    if (!constraint) {
      return { valid: false, error: `Invalid storage category: ${category}` };
    }

    if (size > constraint.maxSizeBytes) {
      const mb = (constraint.maxSizeBytes / (1024 * 1024)).toFixed(0);
      return { valid: false, error: `File size exceeds maximum allowed limit of ${mb}MB.` };
    }

    if (!constraint.allowedMimes.includes(mimeType)) {
      return { valid: false, error: `File MIME type '${mimeType}' is not permitted for ${category}.` };
    }

    return { valid: true };
  }

  async saveFile(category: string, filename: string, buffer: Buffer, mimeType: string): Promise<string> {
    const val = this.validateFile(category, buffer.length, mimeType);
    if (!val.valid) throw new Error(val.error);

    const categoryDir = path.join(this.baseUploadDir, category);
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
    }

    const ext = path.extname(filename) || '.bin';
    const cleanBase = path.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeName = `${cleanBase}_${Date.now()}${ext}`;
    const targetPath = path.join(categoryDir, safeName);

    await fs.promises.writeFile(targetPath, buffer);
    return `/uploads/${category}/${safeName}`;
  }
}
