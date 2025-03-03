import * as crypto from 'crypto';

/**
 * WebRTC encryption modes
 */
export enum EncryptionMode {
  /**
   * No additional encryption beyond standard DTLS
   */
  STANDARD = 'standard',
  
  /**
   * AES-GCM encryption with per-stream key
   */
  AES_GCM = 'aes-gcm',
  
  /**
   * AES-CBC encryption with per-stream key
   */
  AES_CBC = 'aes-cbc',
  
  /**
   * ChaCha20-Poly1305 encryption for better mobile performance
   */
  CHACHA20 = 'chacha20'
}

/**
 * WebRTC encryption key information
 */
export interface EncryptionKeyInfo {
  /**
   * Key ID
   */
  id: string;
  
  /**
   * Encryption key
   */
  key: Buffer;
  
  /**
   * Initialization vector
   */
  iv: Buffer;
  
  /**
   * Algorithm used
   */
  algorithm: string;
  
  /**
   * Creation timestamp
   */
  created: number;
  
  /**
   * Expiration timestamp (optional)
   */
  expires?: number;
}

/**
 * WebRTC encryption header
 */
export interface EncryptionHeader {
  /**
   * Version of the encryption header
   */
  version: number;
  
  /**
   * Key ID used for encryption
   */
  keyId: string;
  
  /**
   * Initialization vector (may be partial or omitted depending on algorithm)
   */
  iv?: Buffer;
  
  /**
   * Encryption algorithm
   */
  algorithm: string;
  
  /**
   * Additional authentication data
   */
  aad?: Buffer;
}

/**
 * WebRTC encryption configuration
 */
export interface EncryptionConfig {
  /**
   * Encryption mode
   */
  mode: EncryptionMode;
  
  /**
   * Key rotation interval in seconds (default: 3600, 0 to disable)
   */
  keyRotationInterval: number;
  
  /**
   * Whether to use per-frame IVs (default: true)
   */
  usePerFrameIV: boolean;
  
  /**
   * Whether to authenticate encryption headers (default: true)
   */
  authenticateHeaders: boolean;
  
  /**
   * Whether to encrypt RTP headers (default: false)
   */
  encryptHeaders: boolean;
  
  /**
   * Whether to encrypt RTCP packets (default: true)
   */
  encryptRTCP: boolean;
}

/**
 * WebRTC encryption statistics
 */
export interface EncryptionStats {
  /**
   * Number of encrypted frames
   */
  encryptedFrames: number;
  
  /**
   * Number of decrypted frames
   */
  decryptedFrames: number;
  
  /**
   * Number of encryption failures
   */
  encryptionFailures: number;
  
  /**
   * Number of decryption failures
   */
  decryptionFailures: number;
  
  /**
   * Average encryption time in milliseconds
   */
  avgEncryptionTime: number;
  
  /**
   * Average decryption time in milliseconds
   */
  avgDecryptionTime: number;
  
  /**
   * Key rotation count
   */
  keyRotations: number;
}

/**
 * WebRTC encryption helper
 * Provides end-to-end encryption functionality for WebRTC streams
 */
export class WebRTCEncryption {
  /**
   * Default encryption configuration
   */
  private static readonly DEFAULT_CONFIG: EncryptionConfig = {
    mode: EncryptionMode.AES_GCM,
    keyRotationInterval: 3600, // 1 hour
    usePerFrameIV: true,
    authenticateHeaders: true,
    encryptHeaders: false,
    encryptRTCP: true
  };
  
  /**
   * Encryption configuration
   */
  private config: EncryptionConfig;
  
  /**
   * Current encryption key
   */
  private currentKey?: EncryptionKeyInfo;
  
  /**
   * Previous encryption keys (for decryption of older frames)
   */
  private previousKeys: Map<string, EncryptionKeyInfo> = new Map();
  
  /**
   * Key rotation timer
   */
  private keyRotationTimer?: NodeJS.Timeout;
  
  /**
   * Encryption statistics
   */
  private stats: EncryptionStats = {
    encryptedFrames: 0,
    decryptedFrames: 0,
    encryptionFailures: 0,
    decryptionFailures: 0,
    avgEncryptionTime: 0,
    avgDecryptionTime: 0,
    keyRotations: 0
  };
  
  /**
   * Create a new WebRTC encryption helper
   * 
   * @param config Optional encryption configuration
   */
  constructor(config?: Partial<EncryptionConfig>) {
    // Merge default config with provided config
    this.config = {
      ...WebRTCEncryption.DEFAULT_CONFIG,
      ...config
    };
    
    // Generate initial key
    this.rotateKey();
    
    // Set up key rotation if enabled
    if (this.config.keyRotationInterval > 0) {
      this.keyRotationTimer = setInterval(
        () => this.rotateKey(),
        this.config.keyRotationInterval * 1000
      );
    }
  }
  
  /**
   * Generate a new encryption key
   */
  private generateKey(): EncryptionKeyInfo {
    const algorithm = this.getAlgorithmName();
    let keyLength = 32; // Default to 256 bits
    let ivLength = 16; // Default to 128 bits
    
    // Adjust key and IV length based on algorithm
    switch (this.config.mode) {
      case EncryptionMode.AES_GCM:
        keyLength = 32; // 256 bits
        ivLength = 12; // 96 bits (recommended for GCM)
        break;
        
      case EncryptionMode.AES_CBC:
        keyLength = 32; // 256 bits
        ivLength = 16; // 128 bits
        break;
        
      case EncryptionMode.CHACHA20:
        keyLength = 32; // 256 bits
        ivLength = 12; // 96 bits (nonce)
        break;
    }
    
    // Generate key ID
    const keyId = crypto.randomBytes(8).toString('hex');
    
    // Generate key and IV
    const key = crypto.randomBytes(keyLength);
    const iv = crypto.randomBytes(ivLength);
    
    // Create key info
    return {
      id: keyId,
      key,
      iv,
      algorithm,
      created: Date.now(),
      expires: this.config.keyRotationInterval > 0 ? 
        Date.now() + (this.config.keyRotationInterval * 1000) : 
        undefined
    };
  }
  
  /**
   * Get algorithm name based on mode
   */
  private getAlgorithmName(): string {
    switch (this.config.mode) {
      case EncryptionMode.AES_GCM:
        return 'aes-256-gcm';
        
      case EncryptionMode.AES_CBC:
        return 'aes-256-cbc';
        
      case EncryptionMode.CHACHA20:
        return 'chacha20-poly1305';
        
      default:
        return '';
    }
  }
  
  /**
   * Rotate the encryption key
   */
  public rotateKey(): void {
    // Generate new key
    const newKey = this.generateKey();
    
    // Store current key as previous key if any
    if (this.currentKey) {
      this.previousKeys.set(this.currentKey.id, this.currentKey);
      
      // Clean up old keys that are expired
      this.cleanupOldKeys();
    }
    
    // Set new key as current key
    this.currentKey = newKey;
    
    // Update stats
    this.stats.keyRotations++;
  }
  
  /**
   * Clean up old encryption keys
   */
  private cleanupOldKeys(): void {
    const now = Date.now();
    
    // Remove expired keys
    for (const [id, key] of this.previousKeys.entries()) {
      if (key.expires && key.expires < now) {
        this.previousKeys.delete(id);
      }
    }
    
    // Limit number of keys to 10
    if (this.previousKeys.size > 10) {
      // Remove oldest keys first
      const keyIds = Array.from(this.previousKeys.keys())
        .sort((a, b) => {
          const keyA = this.previousKeys.get(a)!;
          const keyB = this.previousKeys.get(b)!;
          return keyA.created - keyB.created;
        });
      
      // Remove oldest keys to keep max 10
      while (this.previousKeys.size > 10) {
        this.previousKeys.delete(keyIds.shift()!);
      }
    }
  }
  
  /**
   * Create encryption header for a frame
   * 
   * @param keyId Key ID to use (defaults to current key)
   * @param customIV Custom IV to use (defaults to random IV or derived from base IV)
   */
  private createHeader(keyId?: string, customIV?: Buffer): EncryptionHeader {
    // Use specified key or current key
    const key = keyId ? 
      (this.previousKeys.get(keyId) || this.currentKey!) : 
      this.currentKey!;
    
    // Determine IV
    let iv = customIV;
    if (!iv) {
      if (this.config.usePerFrameIV) {
        // Generate random IV for each frame
        const ivLength = key.iv.length;
        iv = crypto.randomBytes(ivLength);
      } else {
        // Use key's IV
        iv = key.iv;
      }
    }
    
    // Create header
    const header: EncryptionHeader = {
      version: 1,
      keyId: key.id,
      algorithm: key.algorithm,
      iv
    };
    
    // Create AAD for authenticated encryption if needed
    if (this.config.authenticateHeaders) {
      const headerData = Buffer.from(JSON.stringify({
        version: header.version,
        keyId: header.keyId,
        algorithm: header.algorithm
      }));
      
      header.aad = crypto.createHash('sha256')
        .update(headerData)
        .digest()
        .slice(0, 16); // 128 bits
    }
    
    return header;
  }
  
  /**
   * Encrypt a frame
   * 
   * @param data Frame data to encrypt
   * @param header Optional encryption header (created if not provided)
   */
  public encrypt(data: Buffer, header?: EncryptionHeader): { data: Buffer, header: EncryptionHeader } {
    if (!this.currentKey) {
      throw new Error('Encryption key not available');
    }
    
    // Start timing for statistics
    const startTime = Date.now();
    
    try {
      // Create header if not provided
      const encHeader = header || this.createHeader();
      
      // Get key for encryption
      const keyInfo = encHeader.keyId === this.currentKey.id ?
        this.currentKey :
        this.previousKeys.get(encHeader.keyId);
      
      if (!keyInfo) {
        throw new Error(`Key with ID ${encHeader.keyId} not found`);
      }
      
      // Use appropriate encryption algorithm
      let encryptedData: Buffer;
      
      switch (this.config.mode) {
        case EncryptionMode.AES_GCM: {
          // Create cipher
          const cipher = crypto.createCipheriv(
            'aes-256-gcm',
            keyInfo.key,
            encHeader.iv || keyInfo.iv
          );
          
          // Add auth data if present
          if (encHeader.aad) {
            // TypeScript definition doesn't include these methods for GCM
            (cipher as any).setAAD(encHeader.aad);
          }
          
          // Encrypt data
          encryptedData = Buffer.concat([
            cipher.update(data),
            cipher.final()
          ]);
          
          // Get auth tag and append to data
          const authTag = (cipher as any).getAuthTag();
          encryptedData = Buffer.concat([encryptedData, authTag]);
          break;
        }
          
        case EncryptionMode.AES_CBC: {
          // Create cipher
          const cipher = crypto.createCipheriv(
            'aes-256-cbc',
            keyInfo.key,
            encHeader.iv || keyInfo.iv
          );
          
          // Encrypt data
          encryptedData = Buffer.concat([
            cipher.update(data),
            cipher.final()
          ]);
          break;
        }
          
        case EncryptionMode.CHACHA20: {
          // Note: ChaCha20-Poly1305 is not directly available in Node.js crypto
          // This is a placeholder implementation
          if (crypto.getCiphers().includes('chacha20-poly1305')) {
            // If available, use it
            const cipher = crypto.createCipheriv(
              'chacha20-poly1305',
              keyInfo.key,
              encHeader.iv || keyInfo.iv
            );
            
            // Add auth data if present
            if (encHeader.aad) {
              // TypeScript definition doesn't include these methods
              (cipher as any).setAAD(encHeader.aad);
            }
            
            // Encrypt data
            encryptedData = Buffer.concat([
              cipher.update(data),
              cipher.final()
            ]);
            
            // Get auth tag
            const authTag = (cipher as any).getAuthTag();
            encryptedData = Buffer.concat([encryptedData, authTag]);
          } else {
            // Fallback to AES-GCM
            const cipher = crypto.createCipheriv(
              'aes-256-gcm',
              keyInfo.key,
              encHeader.iv || keyInfo.iv
            );
            
            // Add auth data if present
            if (encHeader.aad) {
              // TypeScript definition doesn't include these methods
              (cipher as any).setAAD(encHeader.aad);
            }
            
            // Encrypt data
            encryptedData = Buffer.concat([
              cipher.update(data),
              cipher.final()
            ]);
            
            // Get auth tag
            const authTag = (cipher as any).getAuthTag();
            encryptedData = Buffer.concat([encryptedData, authTag]);
          }
          break;
        }
          
        default:
          throw new Error(`Unsupported encryption mode: ${this.config.mode}`);
      }
      
      // Update statistics
      this.stats.encryptedFrames++;
      this.updateEncryptionTime(Date.now() - startTime);
      
      return {
        data: encryptedData,
        header: encHeader
      };
    } catch (error) {
      // Update statistics
      this.stats.encryptionFailures++;
      
      throw error;
    }
  }
  
  /**
   * Decrypt a frame
   * 
   * @param encryptedData Encrypted frame data
   * @param header Encryption header
   */
  public decrypt(encryptedData: Buffer, header: EncryptionHeader): Buffer {
    // Start timing for statistics
    const startTime = Date.now();
    
    try {
      // Get key for decryption
      const keyInfo = header.keyId === this.currentKey?.id ?
        this.currentKey :
        this.previousKeys.get(header.keyId);
      
      if (!keyInfo) {
        throw new Error(`Key with ID ${header.keyId} not found for decryption`);
      }
      
      // Use appropriate decryption algorithm
      let decryptedData: Buffer;
      
      switch (this.config.mode) {
        case EncryptionMode.AES_GCM: {
          // Extract auth tag from the end of the data (last 16 bytes)
          const authTagLength = 16;
          const authTag = encryptedData.slice(encryptedData.length - authTagLength);
          const actualData = encryptedData.slice(0, encryptedData.length - authTagLength);
          
          // Create decipher
          const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            keyInfo.key,
            header.iv || keyInfo.iv
          );
          
          // Set auth tag
          (decipher as any).setAuthTag(authTag);
          
          // Add auth data if present
          if (header.aad) {
            (decipher as any).setAAD(header.aad);
          }
          
          // Decrypt data
          decryptedData = Buffer.concat([
            decipher.update(actualData),
            decipher.final()
          ]);
          break;
        }
          
        case EncryptionMode.AES_CBC: {
          // Create decipher
          const decipher = crypto.createDecipheriv(
            'aes-256-cbc',
            keyInfo.key,
            header.iv || keyInfo.iv
          );
          
          // Decrypt data
          decryptedData = Buffer.concat([
            decipher.update(encryptedData),
            decipher.final()
          ]);
          break;
        }
          
        case EncryptionMode.CHACHA20: {
          // Note: ChaCha20-Poly1305 is not directly available in Node.js crypto
          // This is a placeholder implementation
          if (crypto.getCiphers().includes('chacha20-poly1305')) {
            // If available, use it
            // Extract auth tag from the end of the data (last 16 bytes)
            const authTagLength = 16;
            const authTag = encryptedData.slice(encryptedData.length - authTagLength);
            const actualData = encryptedData.slice(0, encryptedData.length - authTagLength);
            
            // Create decipher
            const decipher = crypto.createDecipheriv(
              'chacha20-poly1305',
              keyInfo.key,
              header.iv || keyInfo.iv
            );
            
            // Set auth tag
            (decipher as any).setAuthTag(authTag);
            
            // Add auth data if present
            if (header.aad) {
              (decipher as any).setAAD(header.aad);
            }
            
            // Decrypt data
            decryptedData = Buffer.concat([
              decipher.update(actualData),
              decipher.final()
            ]);
          } else {
            // Fallback to AES-GCM
            // Extract auth tag from the end of the data (last 16 bytes)
            const authTagLength = 16;
            const authTag = encryptedData.slice(encryptedData.length - authTagLength);
            const actualData = encryptedData.slice(0, encryptedData.length - authTagLength);
            
            // Create decipher
            const decipher = crypto.createDecipheriv(
              'aes-256-gcm',
              keyInfo.key,
              header.iv || keyInfo.iv
            );
            
            // Set auth tag
            (decipher as any).setAuthTag(authTag);
            
            // Add auth data if present
            if (header.aad) {
              (decipher as any).setAAD(header.aad);
            }
            
            // Decrypt data
            decryptedData = Buffer.concat([
              decipher.update(actualData),
              decipher.final()
            ]);
          }
          break;
        }
          
        default:
          throw new Error(`Unsupported encryption mode: ${this.config.mode}`);
      }
      
      // Update statistics
      this.stats.decryptedFrames++;
      this.updateDecryptionTime(Date.now() - startTime);
      
      return decryptedData;
    } catch (error) {
      // Update statistics
      this.stats.decryptionFailures++;
      
      throw error;
    }
  }
  
  /**
   * Update encryption time statistics
   * 
   * @param time Encryption time in milliseconds
   */
  private updateEncryptionTime(time: number): void {
    if (this.stats.encryptedFrames === 1) {
      this.stats.avgEncryptionTime = time;
    } else {
      // Weighted average (favor recent times)
      this.stats.avgEncryptionTime = 
        (this.stats.avgEncryptionTime * 0.9) + (time * 0.1);
    }
  }
  
  /**
   * Update decryption time statistics
   * 
   * @param time Decryption time in milliseconds
   */
  private updateDecryptionTime(time: number): void {
    if (this.stats.decryptedFrames === 1) {
      this.stats.avgDecryptionTime = time;
    } else {
      // Weighted average (favor recent times)
      this.stats.avgDecryptionTime = 
        (this.stats.avgDecryptionTime * 0.9) + (time * 0.1);
    }
  }
  
  /**
   * Get encryption statistics
   */
  public getStats(): EncryptionStats {
    return { ...this.stats };
  }
  
  /**
   * Serialize encryption header to binary format
   * 
   * @param header Encryption header
   */
  public serializeHeader(header: EncryptionHeader): Buffer {
    // Header format:
    // 1 byte: Version
    // 2 bytes: Key ID length
    // n bytes: Key ID (variable)
    // 1 byte: IV length
    // m bytes: IV (variable or omitted if length is 0)
    // 1 byte: Algorithm length
    // k bytes: Algorithm (variable)
    // 1 byte: AAD length
    // j bytes: AAD (variable or omitted if length is 0)
    
    const keyIdBuf = Buffer.from(header.keyId);
    const algBuf = Buffer.from(header.algorithm);
    const ivBuf = header.iv || Buffer.alloc(0);
    const aadBuf = header.aad || Buffer.alloc(0);
    
    // Calculate total length
    const totalLength = 
      1 + // Version
      2 + // Key ID length
      keyIdBuf.length +
      1 + // IV length
      ivBuf.length +
      1 + // Algorithm length
      algBuf.length +
      1 + // AAD length
      aadBuf.length;
    
    // Create buffer
    const buf = Buffer.alloc(totalLength);
    let offset = 0;
    
    // Write version
    buf.writeUInt8(header.version, offset);
    offset += 1;
    
    // Write key ID
    buf.writeUInt16BE(keyIdBuf.length, offset);
    offset += 2;
    keyIdBuf.copy(buf, offset);
    offset += keyIdBuf.length;
    
    // Write IV
    buf.writeUInt8(ivBuf.length, offset);
    offset += 1;
    if (ivBuf.length > 0) {
      ivBuf.copy(buf, offset);
      offset += ivBuf.length;
    }
    
    // Write algorithm
    buf.writeUInt8(algBuf.length, offset);
    offset += 1;
    algBuf.copy(buf, offset);
    offset += algBuf.length;
    
    // Write AAD
    buf.writeUInt8(aadBuf.length, offset);
    offset += 1;
    if (aadBuf.length > 0) {
      aadBuf.copy(buf, offset);
      offset += aadBuf.length;
    }
    
    return buf;
  }
  
  /**
   * Deserialize encryption header from binary format
   * 
   * @param data Binary header data
   */
  public deserializeHeader(data: Buffer): EncryptionHeader {
    let offset = 0;
    
    // Read version
    const version = data.readUInt8(offset);
    offset += 1;
    
    // Read key ID
    const keyIdLength = data.readUInt16BE(offset);
    offset += 2;
    const keyId = data.slice(offset, offset + keyIdLength).toString();
    offset += keyIdLength;
    
    // Read IV
    const ivLength = data.readUInt8(offset);
    offset += 1;
    let iv: Buffer | undefined;
    if (ivLength > 0) {
      iv = Buffer.from(data.slice(offset, offset + ivLength));
      offset += ivLength;
    }
    
    // Read algorithm
    const algLength = data.readUInt8(offset);
    offset += 1;
    const algorithm = data.slice(offset, offset + algLength).toString();
    offset += algLength;
    
    // Read AAD
    const aadLength = data.readUInt8(offset);
    offset += 1;
    let aad: Buffer | undefined;
    if (aadLength > 0) {
      aad = Buffer.from(data.slice(offset, offset + aadLength));
      offset += aadLength;
    }
    
    return {
      version,
      keyId,
      iv,
      algorithm,
      aad
    };
  }
  
  /**
   * Get current encryption configuration
   */
  public getConfig(): EncryptionConfig {
    return { ...this.config };
  }
  
  /**
   * Update encryption configuration
   * 
   * @param config Partial configuration to update
   */
  public updateConfig(config: Partial<EncryptionConfig>): void {
    // Update config
    this.config = {
      ...this.config,
      ...config
    };
    
    // Update key rotation timer if interval changed
    if (config.keyRotationInterval !== undefined) {
      if (this.keyRotationTimer) {
        clearInterval(this.keyRotationTimer);
        this.keyRotationTimer = undefined;
      }
      
      if (config.keyRotationInterval > 0) {
        this.keyRotationTimer = setInterval(
          () => this.rotateKey(),
          config.keyRotationInterval * 1000
        );
      }
    }
  }
  
  /**
   * Clean up resources
   */
  public cleanup(): void {
    if (this.keyRotationTimer) {
      clearInterval(this.keyRotationTimer);
      this.keyRotationTimer = undefined;
    }
  }
}