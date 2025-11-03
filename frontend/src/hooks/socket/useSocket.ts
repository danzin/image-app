import { useContext } from "react";
import { Socket } from "socket.io-client";
import { SocketContext } from "../../context/Socket/SocketContext";

export function useSocket(): Socket {
	const socket = useContext(SocketContext);
	if (!socket) {
		throw new Error("useSocket must be used within a SocketProvider");
	}
	return socket;
}
