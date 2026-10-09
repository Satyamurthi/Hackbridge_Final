"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = exports.STORAGE_CONSTRAINTS = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
exports.STORAGE_CONSTRAINTS = {
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
class StorageService {
    baseUploadDir;
    constructor(baseUploadDir) {
        this.baseUploadDir = baseUploadDir || path_1.default.join(__dirname, '..', '..', 'uploads');
        if (!fs_1.default.existsSync(this.baseUploadDir)) {
            try {
                fs_1.default.mkdirSync(this.baseUploadDir, { recursive: true });
            }
            catch (err) { }
        }
    }
    validateFile(category, size, mimeType) {
        const constraint = exports.STORAGE_CONSTRAINTS[category];
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
    async saveFile(category, filename, buffer, mimeType) {
        const val = this.validateFile(category, buffer.length, mimeType);
        if (!val.valid)
            throw new Error(val.error);
        const categoryDir = path_1.default.join(this.baseUploadDir, category);
        if (!fs_1.default.existsSync(categoryDir)) {
            fs_1.default.mkdirSync(categoryDir, { recursive: true });
        }
        const ext = path_1.default.extname(filename) || '.bin';
        const cleanBase = path_1.default.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeName = `${cleanBase}_${Date.now()}${ext}`;
        const targetPath = path_1.default.join(categoryDir, safeName);
        await fs_1.default.promises.writeFile(targetPath, buffer);
        return `/uploads/${category}/${safeName}`;
    }
}
exports.StorageService = StorageService;
