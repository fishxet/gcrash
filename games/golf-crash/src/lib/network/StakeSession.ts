export type StakeSessionOptions = {
  websocketUrl?: string;
};

export type StakeSocketMessage = Record<string, unknown>;

const nonEmpty = (value: string | null): string | null => {
  if (!value) return null;
  const next = value.trim();
  return next.length > 0 ? next : null;
};

const defaultWebsocketUrl = (): string => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
};

class StakeSession {
  private sessionID: string | null = null;
  private socket: WebSocket | null = null;

  init(options: StakeSessionOptions = {}): void {
    if (typeof window === "undefined") {
      throw new Error("StakeSession can only be initialized in the browser");
    }

    const params = new URLSearchParams(window.location.search);
    const sessionID = nonEmpty(params.get("sessionID"));
    if (!sessionID) {
      throw new Error("StakeSession initialization failed: missing sessionID query parameter");
    }

    this.sessionID = sessionID;

    if (options.websocketUrl) {
      this.connect(options.websocketUrl);
    }
  }

  getSessionID(): string {
    if (!this.sessionID) {
      throw new Error("StakeSession is not initialized");
    }
    return this.sessionID;
  }

  connect(websocketUrl = defaultWebsocketUrl()): WebSocket {
    const sessionID = this.getSessionID();
    this.disconnect();

    const socket = new WebSocket(websocketUrl);
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.send({
        type: "authenticate",
        sessionID,
      });
    });

    socket.addEventListener("close", () => {
      if (this.socket === socket) this.socket = null;
    });

    return socket;
  }

  send(message: StakeSocketMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("StakeSession WebSocket is not connected");
    }
    this.socket.send(JSON.stringify(message));
  }

  disconnect(): void {
    if (!this.socket) return;
    this.socket.close();
    this.socket = null;
  }
}

export const stakeSession = new StakeSession();
export { StakeSession };
