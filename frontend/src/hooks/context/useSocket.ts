import { useContext } from 'react';
import { SocketContext } from '../../context/Socket/SocketContext';

export const useSocket = () => useContext(SocketContext);