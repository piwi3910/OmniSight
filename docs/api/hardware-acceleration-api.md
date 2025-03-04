# Hardware Acceleration API Documentation

This document outlines the REST API endpoints for hardware acceleration features in the OmniSight platform.

## Base URL

All API endpoints are accessible through the API Gateway:

```
http://localhost:8000/api/v1
```

## Hardware Acceleration Endpoints

### Get Hardware Acceleration Status

```
GET /detection/hardware/acceleration
```

**Description**: Retrieves the current hardware acceleration status and capabilities

**Authentication Required**: Yes (JWT token in Authorization header)

**Permissions**: User, Admin

**Response**:
```json
{
  "status": "success",
  "data": {
    "acceleration": {
      "enabled": true,
      "availablePlatforms": [
        "NVIDIA_CUDA",
        "NVIDIA_TENSORRT",
        "INTEL_OPENVINO",
        "INTEL_ONEAPI",
        "CPU"
      ],
      "activePlatforms": {
        "inference": "NVIDIA_TENSORRT",
        "imageProcessing": "INTEL_ONEAPI"
      },
      "deviceInfo": [
        {
          "deviceId": "gpu-0",
          "platform": "NVIDIA_CUDA",
          "deviceName": "NVIDIA GeForce RTX 3080",
          "memoryTotal": 10240,
          "memoryFree": 8192,
          "utilization": 0.15,
          "capabilities": [
            "INFERENCE",
            "VIDEO_DECODE",
            "VIDEO_ENCODE",
            "IMAGE_PROCESSING"
          ]
        },
        {
          "deviceId": "igpu-0",
          "platform": "INTEL_ONEAPI",
          "deviceName": "Intel Iris Xe Graphics",
          "memoryTotal": 4096,
          "memoryFree": 3072,
          "utilization": 0.05,
          "capabilities": [
            "INFERENCE",
            "VIDEO_DECODE",
            "VIDEO_ENCODE",
            "IMAGE_PROCESSING"
          ]
        }
      ],
      "perfPowerBalance": 0.7
    },
    "model": {
      "path": "/models/coco-ssd",
      "type": "COCO-SSD",
      "classes": 80,
      "taskTypes": [
        "INFERENCE",
        "IMAGE_PROCESSING"
      ]
    },
    "detectionCount": 1250,
    "processingCount": 5000
  }
}
```

### Update Hardware Acceleration Settings

```
POST /detection/hardware/acceleration
```

**Description**: Updates hardware acceleration settings

**Authentication Required**: Yes (JWT token in Authorization header)

**Permissions**: Admin only

**Request Body**:
```json
{
  "enabled": true,
  "preferredPlatform": "NVIDIA_TENSORRT",
  "inferencePlatform": "NVIDIA_TENSORRT",
  "imageProcessingPlatform": "INTEL_ONEAPI",
  "perfPowerBalance": 0.7
}
```

**Parameters**:
- `enabled` (boolean, optional): Enable or disable hardware acceleration
- `preferredPlatform` (string, optional): Preferred hardware platform for all tasks
- `inferencePlatform` (string, optional): Platform specifically for inference tasks
- `imageProcessingPlatform` (string, optional): Platform specifically for image processing tasks
- `perfPowerBalance` (number, optional): Performance vs. power efficiency balance (0-1), where 0 is maximum power efficiency and 1 is maximum performance

**Response**:
```json
{
  "status": "success",
  "message": "Hardware acceleration settings updated",
  "data": {
    "enabled": true,
    "preferredPlatform": "NVIDIA_TENSORRT",
    "inferencePlatform": "NVIDIA_TENSORRT",
    "imageProcessingPlatform": "INTEL_ONEAPI",
    "perfPowerBalance": 0.7
  }
}
```

### Get Hardware Performance Statistics

```
GET /system/performance/hardware
```

**Description**: Retrieves detailed hardware performance statistics

**Authentication Required**: Yes (JWT token in Authorization header)

**Permissions**: Admin only

**Response**:
```json
{
  "status": "success",
  "data": {
    "platforms": {
      "NVIDIA_CUDA": {
        "deviceCount": 1,
        "devices": [
          {
            "id": "gpu-0",
            "name": "NVIDIA GeForce RTX 3080",
            "utilization": 0.15,
            "memoryUsed": 2048,
            "memoryTotal": 10240,
            "temperature": 65,
            "power": 120,
            "clockSpeed": 1400,
            "taskCount": 3
          }
        ],
        "taskDistribution": {
          "INFERENCE": 2,
          "VIDEO_DECODE": 1
        },
        "memoryUsage": 0.2
      },
      "INTEL_ONEAPI": {
        "deviceCount": 1,
        "devices": [
          {
            "id": "igpu-0",
            "name": "Intel Iris Xe Graphics",
            "utilization": 0.1,
            "memoryUsed": 1024,
            "memoryTotal": 4096,
            "temperature": 55,
            "clockSpeed": 1100,
            "taskCount": 2
          }
        ],
        "taskDistribution": {
          "IMAGE_PROCESSING": 2
        },
        "memoryUsage": 0.25
      }
    },
    "activeTasks": 5,
    "tasksByPlatform": {
      "NVIDIA_CUDA": 3,
      "INTEL_ONEAPI": 2
    },
    "optimization": {
      "objective": "BALANCED",
      "perfPowerBalance": 0.7,
      "powerConsumption": 150
    }
  }
}
```

### Update Hardware Optimization Objective

```
POST /system/performance/optimization
```

**Description**: Updates the hardware optimization objective

**Authentication Required**: Yes (JWT token in Authorization header)

**Permissions**: Admin only

**Request Body**:
```json
{
  "objective": "MAXIMUM_PERFORMANCE",
  "perfPowerBalance": 0.9
}
```

**Parameters**:
- `objective` (string, optional): Optimization objective (MAXIMUM_PERFORMANCE, BALANCED, POWER_EFFICIENCY, LOWEST_LATENCY, HIGHEST_THROUGHPUT, THERMAL_OPTIMIZATION)
- `perfPowerBalance` (number, optional): Performance vs. power efficiency balance (0-1)

**Response**:
```json
{
  "status": "success",
  "message": "Optimization objective updated",
  "data": {
    "objective": "MAXIMUM_PERFORMANCE",
    "perfPowerBalance": 0.9,
    "activePlatforms": {
      "inference": "NVIDIA_TENSORRT",
      "imageProcessing": "NVIDIA_CUDA",
      "videoDecoding": "NVIDIA_CUDA",
      "videoEncoding": "NVIDIA_CUDA"
    }
  }
}
```

## Camera-Specific Hardware Acceleration Settings

### Get Camera Hardware Acceleration Settings

```
GET /cameras/:id/hardware-acceleration
```

**Description**: Retrieves hardware acceleration settings for a specific camera

**Authentication Required**: Yes (JWT token in Authorization header)

**Permissions**: User, Admin

**Path Parameters**:
- `id` (string, required): Camera ID

**Response**:
```json
{
  "status": "success",
  "data": {
    "cameraId": "550e8400-e29b-41d4-a716-446655440000",
    "enabled": true,
    "preferredPlatform": "NVIDIA_CUDA",
    "streamDecoding": {
      "platform": "NVIDIA_CUDA",
      "device": "gpu-0"
    },
    "recordingEncoding": {
      "platform": "NVIDIA_CUDA",
      "device": "gpu-0",
      "encoder": "h264_nvenc",
      "preset": "medium"
    },
    "objectDetection": {
      "platform": "NVIDIA_TENSORRT",
      "device": "gpu-0"
    }
  }
}
```

### Update Camera Hardware Acceleration Settings

```
PUT /cameras/:id/hardware-acceleration
```

**Description**: Updates hardware acceleration settings for a specific camera

**Authentication Required**: Yes (JWT token in Authorization header)

**Permissions**: Admin only

**Path Parameters**:
- `id` (string, required): Camera ID

**Request Body**:
```json
{
  "enabled": true,
  "preferredPlatform": "NVIDIA_CUDA",
  "streamDecoding": {
    "platform": "NVIDIA_CUDA"
  },
  "recordingEncoding": {
    "platform": "NVIDIA_CUDA",
    "encoder": "h264_nvenc",
    "preset": "fast"
  },
  "objectDetection": {
    "platform": "NVIDIA_TENSORRT"
  }
}
```

**Response**:
```json
{
  "status": "success",
  "message": "Camera hardware acceleration settings updated",
  "data": {
    "cameraId": "550e8400-e29b-41d4-a716-446655440000",
    "enabled": true,
    "preferredPlatform": "NVIDIA_CUDA",
    "streamDecoding": {
      "platform": "NVIDIA_CUDA",
      "device": "gpu-0"
    },
    "recordingEncoding": {
      "platform": "NVIDIA_CUDA",
      "device": "gpu-0",
      "encoder": "h264_nvenc",
      "preset": "fast"
    },
    "objectDetection": {
      "platform": "NVIDIA_TENSORRT",
      "device": "gpu-0"
    }
  }
}
```

## Error Responses

All API endpoints return standard error responses in the following format:

```json
{
  "status": "error",
  "message": "Error message describing what went wrong",
  "error": {
    "code": "ERROR_CODE",
    "details": {
      // Additional error details specific to the error
    }
  }
}
```

Common error codes:

- `UNAUTHORIZED`: Authentication required or invalid credentials
- `FORBIDDEN`: Insufficient permissions to perform the operation
- `VALIDATION_ERROR`: Invalid request parameters
- `RESOURCE_NOT_FOUND`: The requested resource was not found
- `HARDWARE_NOT_AVAILABLE`: The requested hardware acceleration platform is not available
- `INTERNAL_SERVER_ERROR`: Server encountered an unexpected error