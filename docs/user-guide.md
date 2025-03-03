# OmniSight User Guide

## Introduction

Welcome to OmniSight, your comprehensive video surveillance and security management system. This user guide provides detailed instructions on how to use OmniSight's features effectively for monitoring, recording, and analyzing video from your security cameras.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Camera Management](#camera-management)
4. [Live View](#live-view)
5. [Recordings](#recordings)
6. [Event Detection](#event-detection)
7. [Advanced Search](#advanced-search)
8. [System Settings](#system-settings)
9. [Notifications](#notifications)
10. [Troubleshooting](#troubleshooting)

## Getting Started

### System Requirements

OmniSight works on most modern web browsers:
- Google Chrome (recommended) version 88+
- Mozilla Firefox version 85+
- Microsoft Edge version 88+
- Safari version 14+

### Logging In

1. Open your web browser and navigate to your OmniSight server address.
2. Enter your username and password on the login screen.
3. Click "Sign In" to access the system.

![Login Screen](../assets/screenshots/login.png)

### First Time Setup

If you're logging in for the first time, you'll be prompted to:
1. Change your temporary password
2. Set up notification preferences
3. Complete a system tour to familiarize yourself with the interface

## Dashboard Overview

The dashboard provides an at-a-glance view of your surveillance system:

![Dashboard](../assets/screenshots/dashboard.png)

### Key Elements

1. **Status Overview**: Shows online/offline cameras and system health
2. **Recent Events**: Lists the most recent detection events
3. **Storage Usage**: Displays current storage consumption
4. **Quick Access Tiles**: One-click access to frequently used functions
5. **Activity Timeline**: Shows system activity over the past 24 hours

### Navigation

The main navigation menu is located on the left side of the screen:
- **Dashboard**: System overview (home screen)
- **Cameras**: Camera management and live view
- **Recordings**: Access and playback recorded video
- **Events**: Search and browse detected events
- **Settings**: System configuration
- **Monitoring**: System performance monitoring

## Camera Management

### Viewing Cameras

1. Navigate to the **Cameras** section from the main menu.
2. All connected cameras will be displayed in a grid or list view.
3. Use the toggle in the top-right to switch between views.

![Camera Management](../assets/screenshots/camera-management.png)

### Adding a Camera

1. Click the "Add Camera" button in the top-right.
2. Enter the required information:
   - Camera Name
   - IP Address
   - Port (default: 554 for RTSP)
   - Username
   - Password
   - Location (for categorization)
   - Model (optional)
3. Click "Test Connection" to verify connectivity.
4. Click "Save" to add the camera.

### Camera Settings

To access a camera's settings:
1. Click the gear icon on any camera tile or list item.
2. Adjust settings:
   - **General**: Name, location, description
   - **Connection**: IP address, port, credentials
   - **Video**: Resolution, frame rate, bitrate
   - **Recording**: Continuous or motion-triggered
   - **Detection**: Object detection settings
   - **PTZ**: Pan-tilt-zoom controls (if supported)

### Camera Groups

Organize cameras into logical groups:
1. Go to the **Camera Groups** tab.
2. Click "Create Group".
3. Name the group (e.g., "First Floor", "Exterior").
4. Select cameras to include in the group.
5. Click "Save Group".

## Live View

### Single Camera View

1. From the Cameras page, click on any camera thumbnail to enter single-camera view.
2. Use the control panel at the bottom for:
   - Snapshot capture
   - Manual recording
   - PTZ controls (if available)
   - Digital zoom
   - Full-screen mode

![Single Camera View](../assets/screenshots/single-camera.png)

### Multi-Camera View

1. From the Cameras page, click "Multi-View".
2. Select a layout (2x2, 3x3, 4x4).
3. Drag cameras from the side panel to the desired position.
4. Use the "Save Layout" button to save your configuration.

![Multi-Camera View](../assets/screenshots/multi-camera.png)

### PTZ Controls

For PTZ-enabled cameras:

1. Select a camera with PTZ capabilities.
2. Use the directional controls to pan and tilt.
3. Use the +/- buttons to zoom in/out.
4. Adjust the speed slider to control movement speed.
5. Save positions as presets for quick access.

![PTZ Controls](../assets/screenshots/ptz-controls.png)

#### Creating a Preset

1. Position the camera as desired.
2. Click "Save Preset".
3. Enter a name for the preset.
4. Click "Save".

#### Using Presets

1. Click on a saved preset name.
2. The camera will automatically move to that position.

## Recordings

### Browsing Recordings

1. Navigate to the **Recordings** section from the main menu.
2. Use the calendar to select a date.
3. Use the camera selector to filter by camera.
4. Recordings will be displayed as timeline segments.

![Recordings Browser](../assets/screenshots/recordings-browser.png)

### Playback Controls

When playing back a recording:

- Play/Pause: Control playback
- Skip Forward/Backward: Jump 10 seconds
- Speed Control: Adjust playback speed (0.5x to 8x)
- Timeline Scrubber: Navigate through the recording
- Jump to Event: Navigate directly to detected events

![Playback Controls](../assets/screenshots/playback-controls.png)

### Exporting Recordings

1. During playback, click the "Export" button.
2. Select the time range to export.
3. Choose export options:
   - Format (MP4, AVI)
   - Quality (High, Medium, Low)
   - Include timestamp overlay
   - Add watermark
4. Click "Start Export".
5. Once processing is complete, click "Download".

## Event Detection

### Event Browser

1. Navigate to the **Events** section from the main menu.
2. Events are displayed with thumbnails and key information.
3. Use filters to narrow down results:
   - Date range
   - Camera
   - Event type (person, vehicle, motion)
   - Confidence level

![Event Browser](../assets/screenshots/event-browser.png)

### Event Details

Click on any event to view details:

- Full-size snapshot
- Time and date
- Camera information
- Detected objects with bounding boxes
- Confidence scores
- Quick links to the associated recording

![Event Details](../assets/screenshots/event-details.png)

### Event Timeline

The event timeline provides a visual representation of events:

1. Click the "Timeline" tab in the Events section.
2. Events are displayed as color-coded markers on a timeline.
3. Hover over any marker to see a preview.
4. Click a marker to open the full event details.
5. Use the zoom controls to adjust the time scale.

![Event Timeline](../assets/screenshots/event-timeline.png)

## Advanced Search

### Object-Based Search

Find specific objects across all cameras:

1. Go to the Events section.
2. Click "Advanced Search".
3. Select object types (person, vehicle, animal, etc.).
4. Set a date range.
5. Adjust the confidence threshold.
6. Click "Search".

![Advanced Search](../assets/screenshots/advanced-search.png)

### Metadata Search

Search using additional metadata:

1. In Advanced Search, click "Show Metadata Options".
2. Add key-value pairs for specific attributes.
3. Use the AND/OR operators to combine criteria.
4. Click "Search".

### Saving Searches

Save frequently used search criteria:

1. Configure your search parameters.
2. Click "Save Search".
3. Enter a name for the search.
4. Optionally mark as a favorite.
5. Click "Save".

### Exporting Search Results

1. After running a search, click "Export Results".
2. Choose a format (CSV, JSON, PDF).
3. Click "Export".
4. Download the file when processing is complete.

## System Settings

### User Management

Administrators can manage users:

1. Go to **Settings** > **Users**.
2. View, add, edit, or delete user accounts.
3. Assign roles (Admin, Operator, Viewer).
4. Set password policies.

![User Management](../assets/screenshots/user-management.png)

### Storage Management

Configure storage settings:

1. Go to **Settings** > **Storage**.
2. View current storage usage.
3. Configure retention policies:
   - Keep recordings for X days
   - Automatically delete oldest recordings when space is low
   - Set different policies for different cameras
4. Manage backup settings.

![Storage Management](../assets/screenshots/storage-management.png)

### Detection Settings

Customize object detection:

1. Go to **Settings** > **Detection**.
2. Configure global settings:
   - Detection sensitivity
   - Minimum confidence threshold
   - Object types to detect
3. Configure per-camera settings:
   - Detection zones (regions of interest)
   - Camera-specific thresholds

![Detection Settings](../assets/screenshots/detection-settings.png)

### System Maintenance

Perform system maintenance:

1. Go to **Settings** > **Maintenance**.
2. View system logs.
3. Update software.
4. Backup and restore system configuration.
5. Restart services if needed.

## Notifications

### Notification Types

OmniSight can send notifications for:
- Object detection events
- Camera status changes (online/offline)
- Storage alerts
- System health issues

### Setting Up Notifications

1. Go to **Settings** > **Notifications**.
2. Configure notification methods:
   - In-app notifications
   - Email alerts
   - Mobile push notifications (requires mobile app)
   - Webhooks for integration with other systems
3. Set up notification rules:
   - Which events trigger notifications
   - Time-based rules (e.g., only at night)
   - Minimum confidence levels

![Notification Settings](../assets/screenshots/notification-settings.png)

## Troubleshooting

### Camera Connection Issues

If a camera shows as offline:

1. Verify the camera is powered on and connected to the network.
2. Check that the camera IP address is correct.
3. Verify username and password.
4. Ensure network ports are open (typically 554 for RTSP).
5. Try the "Test Connection" button in camera settings.

### Playback Problems

If video playback is sluggish or not working:

1. Check your browser is up to date.
2. Clear browser cache.
3. Reduce the playback resolution.
4. Ensure sufficient network bandwidth.
5. Check system resources in the Monitoring section.

### Detection Issues

If object detection is not working correctly:

1. Verify detection is enabled for the camera.
2. Check confidence threshold settings.
3. Ensure detection zones are properly configured.
4. Check for objects that may be too small in the field of view.
5. Verify adequate lighting conditions.

### System Performance

If the system is running slowly:

1. Go to the **Monitoring** section.
2. Check CPU, memory, and disk usage.
3. Review active streams and recordings.
4. Consider reducing camera resolution or frame rate.
5. Check network utilization.

### Getting Help

If you need additional assistance:

1. Click the "Help" button in the top-right corner.
2. Check the knowledge base for articles on your specific issue.
3. Use the built-in support ticket system.
4. Contact your system administrator.