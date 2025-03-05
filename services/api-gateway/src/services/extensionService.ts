import { PrismaClient } from '@prisma/client';
import Logger from '../utils/logger';

const prisma = new PrismaClient();
const logger = new Logger('ExtensionService');

export interface Extension {
  id: string;
  name: string;
  description: string;
  developer: string;
  email: string;
  scopes: string[];
  callbackUrl?: string;
  apiKey: string;
  apiSecret: string;
  active: boolean;
  created: Date;
  updated: Date;
  lastUsed?: Date;
}

export class ExtensionService {
  /**
   * Create a new extension
   */
  async createExtension(extension: Extension): Promise<Extension> {
    try {
      const result = await prisma.extension.create({
        data: {
          id: extension.id,
          name: extension.name,
          description: extension.description,
          developer: extension.developer,
          email: extension.email,
          scopes: extension.scopes,
          callbackUrl: extension.callbackUrl,
          apiKey: extension.apiKey,
          apiSecret: extension.apiSecret,
          active: extension.active,
          created: extension.created,
          updated: extension.updated
        }
      });
      
      return result as Extension;
    } catch (error) {
      logger.error('Error creating extension', { error, extensionId: extension.id });
      throw error;
    }
  }

  /**
   * Find extension by ID
   */
  async findExtensionById(id: string): Promise<Extension | null> {
    try {
      const extension = await prisma.extension.findUnique({
        where: { id }
      });
      
      return extension as Extension | null;
    } catch (error) {
      logger.error('Error finding extension by ID', { error, extensionId: id });
      throw error;
    }
  }

  /**
   * Find extension by API key
   */
  async findExtensionByApiKey(apiKey: string): Promise<Extension | null> {
    try {
      const extension = await prisma.extension.findFirst({
        where: { apiKey, active: true }
      });
      
      return extension as Extension | null;
    } catch (error) {
      logger.error('Error finding extension by API key', { error });
      throw error;
    }
  }

  /**
   * Find extensions with pagination
   */
  async findExtensions(
    filter: { active?: boolean },
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: Extension[], total: number }> {
    try {
      const skip = (page - 1) * limit;
      
      const [extensions, total] = await Promise.all([
        prisma.extension.findMany({
          where: filter,
          skip,
          take: limit,
          orderBy: { created: 'desc' }
        }),
        prisma.extension.count({ where: filter })
      ]);
      
      return {
        data: extensions as Extension[],
        total
      };
    } catch (error) {
      logger.error('Error finding extensions', { error, filter, page, limit });
      throw error;
    }
  }

  /**
   * Update extension
   */
  async updateExtension(id: string, data: Partial<Extension>): Promise<Extension | null> {
    try {
      const extension = await prisma.extension.update({
        where: { id },
        data
      });
      
      return extension as Extension;
    } catch (error) {
      logger.error('Error updating extension', { error, extensionId: id });
      throw error;
    }
  }

  /**
   * Delete extension
   */
  async deleteExtension(id: string): Promise<void> {
    try {
      await prisma.extension.delete({
        where: { id }
      });
    } catch (error) {
      logger.error('Error deleting extension', { error, extensionId: id });
      throw error;
    }
  }

  /**
   * Update last used timestamp
   */
  async updateLastUsed(id: string): Promise<void> {
    try {
      await prisma.extension.update({
        where: { id },
        data: { lastUsed: new Date() }
      });
    } catch (error) {
      logger.error('Error updating last used timestamp', { error, extensionId: id });
      // Swallow error to avoid disrupting the API call
    }
  }

  /**
   * Validate extension API credentials
   */
  async validateCredentials(apiKey: string, apiSecret: string): Promise<Extension | null> {
    try {
      const extension = await this.findExtensionByApiKey(apiKey);
      
      if (!extension) {
        return null;
      }
      
      // Validate API secret
      const bcrypt = await import('bcrypt');
      const isValid = await bcrypt.compare(apiSecret, extension.apiSecret);
      
      if (!isValid) {
        return null;
      }
      
      // Update last used timestamp
      await this.updateLastUsed(extension.id);
      
      return extension;
    } catch (error) {
      logger.error('Error validating credentials', { error });
      throw error;
    }
  }
}