import { EventEmitter } from 'events';
import { IceServerConfig } from './PeerConnectionManager';

/**
 * NAT traversal configuration
 */
export interface NATTraversalConfig {
  /**
   * List of STUN servers to use
   */
  stunServers: string[];

  /**
   * List of TURN servers with credentials
   */
  turnServers: {
    urls: string | string[];
    username: string;
    credential: string;
    credentialType?: 'password' | 'oauth';
  }[];

  /**
   * NAT traversal mode
   */
  mode: 'all' | 'relay-only' | 'no-relay';

  /**
   * ICE candidate gathering timeout in milliseconds
   */
  gatheringTimeout: number;

  /**
   * Connection attempt timeout in milliseconds
   */
  connectionTimeout: number;

  /**
   * Maximum number of connection attempts
   */
  maxConnectionAttempts: number;
}

/**
 * ICE candidate type
 */
export enum ICECandidateType {
  HOST = 'host',
  SRFLX = 'srflx', // Server reflexive (from STUN server)
  PRFLX = 'prflx', // Peer reflexive (from peer)
  RELAY = 'relay', // Relayed through TURN server
}

/**
 * ICE candidate information
 */
export interface ICECandidateInfo {
  /**
   * ICE candidate type
   */
  type: ICECandidateType;

  /**
   * IP address
   */
  address: string;

  /**
   * Port number
   */
  port: number;

  /**
   * Protocol (UDP or TCP)
   */
  protocol: 'udp' | 'tcp';

  /**
   * Network type if available
   */
  networkType?: string;

  /**
   * Priority value
   */
  priority: number;

  /**
   * Full candidate string
   */
  raw: string;
}

/**
 * NAT traversal statistics
 */
export interface NATTraversalStats {
  /**
   * Connection attempt count
   */
  connectionAttempts: number;

  /**
   * Time taken to establish connection in milliseconds
   */
  connectionTime: number;

  /**
   * ICE candidate gathering time in milliseconds
   */
  gatheringTime: number;

  /**
   * Failed connection attempts
   */
  failedAttempts: number;

  /**
   * Selected ICE candidate pair
   */
  selectedCandidatePair?: {
    local: ICECandidateInfo;
    remote: ICECandidateInfo;
  };

  /**
   * Number of ICE candidates gathered by type
   */
  candidateCounts: {
    host: number;
    srflx: number;
    relay: number;
    prflx: number;
  };

  /**
   * Network round trip time in milliseconds
   */
  rtt?: number;

  /**
   * Was direct connection possible or relay needed
   */
  relayRequired: boolean;
}

/**
 * Network type detection result
 */
export interface NetworkTypeInfo {
  /**
   * Is the client behind NAT
   */
  behindNAT: boolean;

  /**
   * NAT type if detectable
   */
  natType?: 'symmetric' | 'restricted' | 'port-restricted' | 'full-cone' | 'unknown';

  /**
   * Is the client behind a symmetric NAT
   * (Symmetric NATs are problematic for WebRTC)
   */
  symmetricNAT: boolean;

  /**
   * Can the client use UDP
   */
  udpBlocked: boolean;

  /**
   * External IP address if detectable
   */
  externalIP?: string;
}

/**
 * NAT traversal events
 */
export enum NATTraversalEvent {
  /**
   * Server reachability changed
   */
  SERVER_REACHABILITY_CHANGED = 'server-reachability-changed',

  /**
   * Network type detected
   */
  NETWORK_TYPE_DETECTED = 'network-type-detected',

  /**
   * Connection strategy selected
   */
  STRATEGY_SELECTED = 'strategy-selected',

  /**
   * ICE candidate gathered
   */
  CANDIDATE_GATHERED = 'candidate-gathered',

  /**
   * Connection established
   */
  CONNECTION_ESTABLISHED = 'connection-established',

  /**
   * Connection failed
   */
  CONNECTION_FAILED = 'connection-failed',

  /**
   * Error occurred
   */
  ERROR = 'error',
}

/**
 * NAT traversal strategy
 */
export enum NATTraversalStrategy {
  /**
   * Try direct connection first
   */
  DIRECT_FIRST = 'direct-first',

  /**
   * Try relay connection first
   */
  RELAY_FIRST = 'relay-first',

  /**
   * Use direct connection only
   */
  DIRECT_ONLY = 'direct-only',

  /**
   * Use relay connection only
   */
  RELAY_ONLY = 'relay-only',

  /**
   * Use parallel connection attempts
   */
  PARALLEL = 'parallel',
}

/**
 * NAT traversal helper
 * Assists with WebRTC connection establishment through NATs and firewalls
 */
export class NATTraversalHelper extends EventEmitter {
  /**
   * Default configuration for NAT traversal
   */
  private static readonly DEFAULT_CONFIG: NATTraversalConfig = {
    stunServers: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
    turnServers: [],
    mode: 'all',
    gatheringTimeout: 5000,
    connectionTimeout: 10000,
    maxConnectionAttempts: 3,
  };

  /**
   * NAT traversal configuration
   */
  private config: NATTraversalConfig;

  /**
   * Network type information
   */
  private networkTypeInfo?: NetworkTypeInfo;

  /**
   * Server reachability status
   */
  private serverReachability: Map<string, boolean> = new Map();

  /**
   * Selected NAT traversal strategy
   */
  private selectedStrategy: NATTraversalStrategy = NATTraversalStrategy.DIRECT_FIRST;

  /**
   * NAT traversal statistics
   */
  private stats: NATTraversalStats = {
    connectionAttempts: 0,
    connectionTime: 0,
    gatheringTime: 0,
    failedAttempts: 0,
    candidateCounts: {
      host: 0,
      srflx: 0,
      relay: 0,
      prflx: 0,
    },
    relayRequired: false,
  };

  /**
   * STUN server connection checker timeouts
   */
  private stunCheckerTimeouts: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Create a new NAT traversal helper
   *
   * @param config Optional configuration
   */
  constructor(config?: Partial<NATTraversalConfig>) {
    super();

    // Merge default config with provided config
    this.config = {
      ...NATTraversalHelper.DEFAULT_CONFIG,
      ...config,
    };

    // Initialize
    this.initialize();
  }

  /**
   * Initialize the NAT traversal helper
   */
  private initialize(): void {
    // Check server reachability
    this.checkServerReachability();

    // Detect network type
    this.detectNetworkType();
  }

  /**
   * Check STUN and TURN server reachability
   */
  private async checkServerReachability(): Promise<void> {
    // Check STUN servers
    await Promise.all(
      this.config.stunServers.map(server => this.checkStunServerReachability(server))
    );

    // Check TURN servers
    await Promise.all(
      this.config.turnServers.map(server => this.checkTurnServerReachability(server))
    );
  }

  /**
   * Check if a STUN server is reachable
   *
   * @param server STUN server URL
   */
  private async checkStunServerReachability(server: string): Promise<boolean> {
    try {
      // Create a simple probe to the STUN server
      // In a real implementation, we would send a STUN binding request
      // For simulation purposes, we'll just set a timeout
      const timeout = setTimeout(() => {
        this.setServerReachability(server, false);
      }, 5000);

      this.stunCheckerTimeouts.set(server, timeout);

      // For simulation, assume servers are reachable after a short delay
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

      clearTimeout(this.stunCheckerTimeouts.get(server));
      this.stunCheckerTimeouts.delete(server);

      // Set server as reachable
      this.setServerReachability(server, true);
      return true;
    } catch {
      // Mark server as unreachable
      this.setServerReachability(server, false);
      return false;
    }
  }

  /**
   * Check if a TURN server is reachable
   *
   * @param server TURN server configuration
   */
  private async checkTurnServerReachability(server: {
    urls: string | string[];
    username: string;
    credential: string;
  }): Promise<boolean> {
    // Extract server URLs
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];

    // Check each URL
    const results = await Promise.all(
      urls.map(async url => {
        try {
          // Create a simple probe to the TURN server
          // In a real implementation, we would send a TURN allocate request
          // For simulation purposes, we'll just simulate a delay

          // For simulation, assume servers are reachable after a short delay
          await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1500));

          // Set server as reachable
          this.setServerReachability(url, true);
          return true;
        } catch {
          this.setServerReachability(url, false);
          return false;
        }
      })
    );

    // Return true if any URL is reachable
    return results.some(result => result);
  }

  /**
   * Set server reachability status
   *
   * @param server Server URL
   * @param reachable Whether the server is reachable
   */
  private setServerReachability(server: string, reachable: boolean): void {
    const previousStatus = this.serverReachability.get(server);

    // Update status
    this.serverReachability.set(server, reachable);

    // Emit event if status changed
    if (previousStatus !== reachable) {
      this.emit(NATTraversalEvent.SERVER_REACHABILITY_CHANGED, {
        server,
        reachable,
      });
    }
  }

  /**
   * Detect network type
   */
  private async detectNetworkType(): Promise<NetworkTypeInfo> {
    // In a real implementation, we would use multiple STUN requests to different servers
    // to determine the NAT type using techniques like STUN/TURN

    // For simulation, create a simulated network type with realistic values
    const info: NetworkTypeInfo = {
      behindNAT: Math.random() > 0.2, // 80% chance of being behind NAT
      symmetricNAT: Math.random() > 0.7, // 30% chance of symmetric NAT
      udpBlocked: Math.random() > 0.9, // 10% chance of UDP being blocked
    };

    // Determine NAT type
    if (info.behindNAT) {
      if (info.symmetricNAT) {
        info.natType = 'symmetric';
      } else if (Math.random() > 0.5) {
        info.natType = Math.random() > 0.5 ? 'restricted' : 'port-restricted';
      } else {
        info.natType = 'full-cone';
      }
    }

    // External IP (simulated)
    if (info.behindNAT) {
      const ipParts = [];
      for (let i = 0; i < 4; i++) {
        ipParts.push(Math.floor(Math.random() * 255));
      }
      info.externalIP = ipParts.join('.');
    }

    // Store network type
    this.networkTypeInfo = info;

    // Emit event
    this.emit(NATTraversalEvent.NETWORK_TYPE_DETECTED, info);

    // Select appropriate strategy based on network type
    this.selectStrategy();

    return info;
  }

  /**
   * Select NAT traversal strategy based on network type and server reachability
   */
  private selectStrategy(): void {
    if (!this.networkTypeInfo) {
      return;
    }

    // Start with default strategy
    let strategy = NATTraversalStrategy.DIRECT_FIRST;

    // Check if direct connections are likely to work
    const directLikelyToWork =
      !this.networkTypeInfo.behindNAT ||
      (this.networkTypeInfo.natType === 'full-cone' && !this.networkTypeInfo.udpBlocked);

    // Check if we have reachable TURN servers
    const hasTurnServers = this.config.turnServers.some(server => {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      return urls.some(url => this.serverReachability.get(url));
    });

    // Determine strategy based on NAT type, server reachability, and config mode
    if (this.config.mode === 'relay-only' && hasTurnServers) {
      strategy = NATTraversalStrategy.RELAY_ONLY;
    } else if (this.config.mode === 'no-relay') {
      strategy = NATTraversalStrategy.DIRECT_ONLY;
    } else if (this.networkTypeInfo.symmetricNAT || this.networkTypeInfo.udpBlocked) {
      // Symmetric NAT or UDP blocked means we should try relay first
      strategy = hasTurnServers ? NATTraversalStrategy.RELAY_FIRST : NATTraversalStrategy.PARALLEL;
    } else if (directLikelyToWork) {
      strategy = NATTraversalStrategy.DIRECT_FIRST;
    } else {
      // For others, try parallel approach for faster connection
      strategy = NATTraversalStrategy.PARALLEL;
    }

    // Store selected strategy
    this.selectedStrategy = strategy;

    // Emit event
    this.emit(NATTraversalEvent.STRATEGY_SELECTED, {
      strategy,
      networkInfo: this.networkTypeInfo,
    });
  }

  /**
   * Get optimized ICE servers configuration for the current network conditions
   */
  public getOptimizedIceServers(): IceServerConfig[] {
    const iceServers: IceServerConfig[] = [];

    // Use strategy to optimize ICE server order
    switch (this.selectedStrategy) {
      case NATTraversalStrategy.DIRECT_ONLY:
        // Only add STUN servers
        for (const server of this.config.stunServers) {
          if (this.serverReachability.get(server)) {
            iceServers.push({ urls: server });
          }
        }
        break;

      case NATTraversalStrategy.RELAY_ONLY:
        // Only add TURN servers
        for (const server of this.config.turnServers) {
          const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
          if (urls.some(url => this.serverReachability.get(url))) {
            iceServers.push(server);
          }
        }
        break;

      case NATTraversalStrategy.RELAY_FIRST:
        // Add TURN servers first, then STUN servers
        // Add TURN servers
        for (const server of this.config.turnServers) {
          const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
          if (urls.some(url => this.serverReachability.get(url))) {
            iceServers.push(server);
          }
        }

        // Add STUN servers
        for (const server of this.config.stunServers) {
          if (this.serverReachability.get(server)) {
            iceServers.push({ urls: server });
          }
        }
        break;

      case NATTraversalStrategy.DIRECT_FIRST:
      case NATTraversalStrategy.PARALLEL:
      default:
        // Add STUN servers first, then TURN servers
        // Add STUN servers
        for (const server of this.config.stunServers) {
          if (this.serverReachability.get(server)) {
            iceServers.push({ urls: server });
          }
        }

        // Add TURN servers
        for (const server of this.config.turnServers) {
          const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
          if (urls.some(url => this.serverReachability.get(url))) {
            iceServers.push(server);
          }
        }
        break;
    }

    // If no servers are reachable, use default STUN servers
    if (iceServers.length === 0) {
      iceServers.push({ urls: 'stun:stun.l.google.com:19302' });
    }

    return iceServers;
  }

  /**
   * Parse ICE candidate string into ICE candidate info
   *
   * @param candidateStr ICE candidate string
   */
  public parseIceCandidate(candidateStr: string): ICECandidateInfo | null {
    // Candidate format example:
    // candidate:1853887674 1 udp 2122194687 192.168.0.1 61349 typ host generation 0 ufrag w75f network-id 1

    try {
      const parts = candidateStr.split(' ');

      // Check if this is a proper candidate string
      if (!parts[0].startsWith('candidate:') && parts[0] !== 'a=candidate:') {
        return null;
      }

      // Remove 'candidate:' or 'a=candidate:' prefix
      if (parts[0].startsWith('a=candidate:')) {
        parts[0] = parts[0].substring(12);
      } else {
        parts[0] = parts[0].substring(10);
      }

      // Extract basic information
      // foundation and component not used in this implementation but would be in a real one
      // const foundation = parts[0];
      // const component = parseInt(parts[1]);
      const protocol = parts[2].toLowerCase() as 'udp' | 'tcp';
      const priority = parseInt(parts[3]);
      const address = parts[4];
      const port = parseInt(parts[5]);

      // Find candidate type
      let type: ICECandidateType = ICECandidateType.HOST;
      let i = 6;
      while (i < parts.length - 1) {
        if (parts[i] === 'typ') {
          const typeStr = parts[i + 1].toLowerCase();
          switch (typeStr) {
            case 'host':
              type = ICECandidateType.HOST;
              break;
            case 'srflx':
              type = ICECandidateType.SRFLX;
              break;
            case 'prflx':
              type = ICECandidateType.PRFLX;
              break;
            case 'relay':
              type = ICECandidateType.RELAY;
              break;
          }
          break;
        }
        i++;
      }

      // Extract network type if available
      let networkType: string | undefined;
      i = 6;
      while (i < parts.length - 1) {
        if (parts[i] === 'network-id') {
          networkType = parts[i + 1];
          break;
        }
        i++;
      }

      // Create ICE candidate info
      const info: ICECandidateInfo = {
        type,
        address,
        port,
        protocol,
        networkType,
        priority,
        raw: candidateStr,
      };

      return info;
    } catch (error) {
      console.error('Error parsing ICE candidate:', error);
      return null;
    }
  }

  /**
   * Record gathered ICE candidate
   *
   * @param candidateStr ICE candidate string
   */
  public recordGatheredCandidate(candidateStr: string): ICECandidateInfo | null {
    const info = this.parseIceCandidate(candidateStr);

    if (info) {
      // Update statistics
      switch (info.type) {
        case ICECandidateType.HOST:
          this.stats.candidateCounts.host++;
          break;
        case ICECandidateType.SRFLX:
          this.stats.candidateCounts.srflx++;
          break;
        case ICECandidateType.PRFLX:
          this.stats.candidateCounts.prflx++;
          break;
        case ICECandidateType.RELAY:
          this.stats.candidateCounts.relay++;
          break;
      }

      // Emit event
      this.emit(NATTraversalEvent.CANDIDATE_GATHERED, info);
    }

    return info;
  }

  /**
   * Record selected ICE candidate pair
   *
   * @param local Local ICE candidate string
   * @param remote Remote ICE candidate string
   */
  public recordSelectedCandidatePair(local: string, remote: string): void {
    const localInfo = this.parseIceCandidate(local);
    const remoteInfo = this.parseIceCandidate(remote);

    if (localInfo && remoteInfo) {
      // Update statistics
      this.stats.selectedCandidatePair = {
        local: localInfo,
        remote: remoteInfo,
      };

      // Check if relay was required
      this.stats.relayRequired =
        localInfo.type === ICECandidateType.RELAY || remoteInfo.type === ICECandidateType.RELAY;

      // Emit connection established event
      this.emit(NATTraversalEvent.CONNECTION_ESTABLISHED, {
        local: localInfo,
        remote: remoteInfo,
        relayRequired: this.stats.relayRequired,
      });
    }
  }

  /**
   * Record connection attempt
   *
   * @param successful Whether the connection attempt was successful
   * @param duration Duration of the connection attempt in milliseconds
   */
  public recordConnectionAttempt(successful: boolean, duration: number): void {
    // Update statistics
    this.stats.connectionAttempts++;

    if (successful) {
      this.stats.connectionTime = duration;
    } else {
      this.stats.failedAttempts++;

      // Emit connection failed event
      this.emit(NATTraversalEvent.CONNECTION_FAILED, {
        attempts: this.stats.connectionAttempts,
        failedAttempts: this.stats.failedAttempts,
        duration,
      });
    }
  }

  /**
   * Get NAT traversal statistics
   */
  public getStats(): NATTraversalStats {
    return { ...this.stats };
  }

  /**
   * Get network type information
   */
  public getNetworkTypeInfo(): NetworkTypeInfo | undefined {
    return this.networkTypeInfo ? { ...this.networkTypeInfo } : undefined;
  }

  /**
   * Get selected NAT traversal strategy
   */
  public getSelectedStrategy(): NATTraversalStrategy {
    return this.selectedStrategy;
  }

  /**
   * Generate ICE configuration for WebRTC
   */
  public generateIceConfiguration(): {
    iceServers: IceServerConfig[];
    iceTransportPolicy: 'relay' | 'all';
    iceCandidatePoolSize: number;
    bundlePolicy: string;
    rtcpMuxPolicy: string;
  } {
    return {
      iceServers: this.getOptimizedIceServers(),
      iceTransportPolicy:
        this.selectedStrategy === NATTraversalStrategy.RELAY_ONLY ? 'relay' : 'all',
      iceCandidatePoolSize: 5, // Increase for faster connections
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    };
  }

  /**
   * Get connection timeout based on strategy and network conditions
   */
  public getConnectionTimeout(): number {
    // Start with base timeout
    let timeout = this.config.connectionTimeout;

    // Adjust based on network conditions
    if (this.networkTypeInfo) {
      if (this.networkTypeInfo.symmetricNAT) {
        timeout += 5000; // Add 5 seconds for symmetric NAT
      }

      if (this.networkTypeInfo.udpBlocked) {
        timeout += 3000; // Add 3 seconds for UDP blocking
      }
    }

    // Adjust based on strategy
    switch (this.selectedStrategy) {
      case NATTraversalStrategy.RELAY_ONLY:
        timeout += 2000; // Add 2 seconds for relay-only
        break;
      case NATTraversalStrategy.PARALLEL:
        timeout -= 2000; // Reduce by 2 seconds for parallel attempts
        break;
    }

    // Ensure minimum timeout
    return Math.max(5000, timeout);
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    // Clear all timeouts
    for (const timeout of this.stunCheckerTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.stunCheckerTimeouts.clear();

    // Remove all listeners
    this.removeAllListeners();
  }
}
