// Type definitions without Prisma dependencies
export interface Camera {
  id: string;
  name: string;
  rtspUrl: string;
  username?: string | null;
  password?: string | null;
  status: 'ONLINE' | 'OFFLINE' | 'ERROR';
  ipAddress?: string | null;
  model?: string | null;
  location?: string | null;
  settings?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface Stream {
  id: string;
  cameraId: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  startedAt?: Date | null;
  endedAt?: Date | null;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}