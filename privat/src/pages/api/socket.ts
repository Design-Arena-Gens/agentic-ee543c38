import type { NextApiRequest, NextApiResponse } from "next";
import { Server } from "socket.io";

import { emitToGroup, emitToUser, setIO } from "@/lib/realtime";

type NextApiResponseServerIO = NextApiResponse & {
  socket: {
    server: {
      io?: Server;
    };
  };
};

const SocketHandler = (req: NextApiRequest, res: NextApiResponseServerIO) => {
  const socketServer = res.socket.server as unknown as {
    io?: Server;
  };

  if (!socketServer.io) {
    const httpServer = res.socket.server as unknown as any;
    const io = new Server(httpServer, {
      path: "/api/socket",
      addTrailingSlash: false,
      cors: {
        origin: "*",
      },
    });

    setIO(io);

    io.on("connection", (socket) => {
      const { userCode } = socket.handshake.query;
      if (typeof userCode === "string") {
        socket.join(`user:${userCode}`);
      }

      socket.on("joinGroup", (groupCode: string) => {
        if (typeof groupCode === "string") {
          socket.join(`group:${groupCode}`);
        }
      });

      socket.on("leaveGroup", (groupCode: string) => {
        if (typeof groupCode === "string") {
          socket.leave(`group:${groupCode}`);
        }
      });

      socket.on("call:signal", (payload) => {
        const { sessionCode, targetCode, data, callType, fromCode } =
          payload ?? {};
        if (!sessionCode || !targetCode) return;
        if (typeof targetCode === "string") {
          io.to(`user:${targetCode}`).emit("call:signal", {
            sessionCode,
            data,
            callType: typeof callType === "string" ? callType : undefined,
            fromCode:
              typeof fromCode === "string"
                ? fromCode
                : typeof userCode === "string"
                  ? userCode
                  : undefined,
          });
        }
      });

      socket.on("message:typing", (payload: { targetCode: string }) => {
        if (payload?.targetCode) {
          emitToUser(payload.targetCode, "message:typing", {
            from: userCode,
            timestamp: Date.now(),
          });
        }
      });

      socket.on("disconnect", () => {
        // noop placeholder for potential cleanup
      });
    });

    socketServer.io = io;
  }
  res.end();
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default SocketHandler;
